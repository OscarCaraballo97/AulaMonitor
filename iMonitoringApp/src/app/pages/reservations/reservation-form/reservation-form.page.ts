import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidatorFn } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController, AlertController } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common';
import { ReservationService } from '../../../services/reservation.service';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError, tap, finalize } from 'rxjs/operators'; 

export function dateTimeOrderValidator(): ValidatorFn {
  return (group: AbstractControl): { [key: string]: any } | null => {
    const startControl = group.get('startTime');
    const endControl = group.get('endTime');
    if (startControl && endControl && startControl.value && endControl.value) {
        const startDate = new Date(startControl.value);
        const endDate = new Date(endControl.value);
        if (endDate <= startDate) {
            endControl.setErrors({ ...endControl.errors, dateTimeOrder: true });
            return { invalidDateTimeOrder: true };
        }
    }
    if (endControl?.hasError('dateTimeOrder')) {
        const startValue = startControl?.value;
        const endValue = endControl?.value;
        if (startValue && endValue) {
            const startDate = new Date(startValue);
            const endDate = new Date(endValue);
            if (endDate > startDate) {
                const errors = { ...endControl.errors };
                delete errors['dateTimeOrder'];
                if (Object.keys(errors).length === 0) endControl.setErrors(null);
                else endControl.setErrors(errors);
            }
        }
    }
    return null;
  };
}

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.page.html',
  styleUrls: ['./reservation-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
  providers: [DatePipe]
})
export class ReservationFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  reservationForm!: FormGroup;
  isEditMode = false;
  reservationId: string | null = null;
  pageTitle = 'Nueva Reserva';
  isLoading = false;
  isLoadingInitialData = true;
  currentUser: User | null = null;
  userRole: Rol | null = null;

  classrooms: Classroom[] = [];
  availableStatuses = Object.values(ReservationStatus);
  public RolEnum = Rol;
  minDateValue: string;
  minEndDateValue: string;

  constructor(
    private fb: FormBuilder,
    private reservationService: ReservationService,
    private classroomService: ClassroomService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private alertCtrl: AlertController,
    private cdr: ChangeDetectorRef,
    private datePipe: DatePipe
  ) {
    const now = new Date();
    this.minDateValue = this.datePipe.transform(now, 'yyyy-MM-ddTHH:mm') || '';
    this.minEndDateValue = this.minDateValue;
    console.log("ReservationFormPage: Constructor - minDateValue:", this.minDateValue);
  }

  ngOnInit() {
    console.log("ReservationFormPage: ngOnInit INICIADO");
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    const now = new Date();
    let defaultStartHour = now.getHours() + 1;
    let defaultStartMinutes = 0;
    if (defaultStartHour >= 22) {
        now.setDate(now.getDate() + 1);
        defaultStartHour = 7;
    }
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), defaultStartHour, defaultStartMinutes, 0);
    const defaultEndTime = new Date(defaultStartTime.getTime() + (60 * 60 * 1000));

    this.reservationForm = this.fb.group({
      classroomId: [null, Validators.required],
      userId: [null],
      startTime: [defaultStartTime.toISOString(), Validators.required],
      endTime: [defaultEndTime.toISOString(), Validators.required],
      purpose: ['', Validators.maxLength(255)],
    }, { validators: dateTimeOrderValidator() });

    console.log("ReservationFormPage: Formulario inicializado con valores:", this.reservationForm.value);

    this.reservationForm.get('startTime')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.minEndDateValue = value || this.minDateValue;
      console.log("ReservationFormPage: startTime changed, minEndDateValue:", this.minEndDateValue);
      this.cdr.detectChanges();
    });

    forkJoin({
      user: this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)),
      role: this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)),
      classroomsData: this.classroomService.getAllClassrooms().pipe(
        takeUntil(this.destroy$),
        tap(cls => console.log("ReservationFormPage: Aulas CRUDAS recibidas del servicio:", JSON.stringify(cls))),
        catchError(err => {
          console.error("ReservationFormPage: Error cargando aulas:", err);
          this.presentToast('Error crítico: No se pudieron cargar las aulas.', 'danger');
          return of([] as Classroom[]);
        })
      )
    }).pipe(
      finalize(() => { 
        this.isLoadingInitialData = false;
        this.cdr.detectChanges();
        console.log("ReservationFormPage: forkJoin finalizado, isLoadingInitialData =", this.isLoadingInitialData);
      })
    ).subscribe(results => {
      this.currentUser = results.user;
      this.userRole = results.role;
      this.classrooms = results.classroomsData;
      console.log("ReservationFormPage: Datos de forkJoin recibidos:", {
        user: this.currentUser,
        role: this.userRole,
        classroomsCount: this.classrooms.length
      });
      if (this.classrooms.length > 0) {
        console.log("ReservationFormPage: Primera aula de la lista:", JSON.stringify(this.classrooms[0]));
      }

      if (!this.canAccessForm()) {
        this.presentToast('No tienes permiso para acceder a esta funcionalidad.', 'danger');
        this.navCtrl.navigateBack('/app/dashboard');
        return; 
      }

      if (this.userRole !== Rol.ADMIN && this.currentUser?.id) {
        this.reservationForm.patchValue({ userId: this.currentUser.id });
        this.reservationForm.get('userId')?.disable();
      } else if (this.userRole === Rol.ADMIN) {
        this.reservationForm.get('userId')?.enable();
      }

      this.reservationId = this.route.snapshot.paramMap.get('id');
      if (this.reservationId) {
        this.isEditMode = true;
        this.pageTitle = 'Editar Reserva';

        if (this.userRole === Rol.ADMIN) {
            if (!this.reservationForm.contains('status')) {
                 this.reservationForm.addControl('status', this.fb.control(ReservationStatus.PENDIENTE, Validators.required));
            }
            this.reservationForm.get('status')?.enable();
        }
        this.loadReservationData(this.reservationId); 
      } else { 
        this.pageTitle = 'Nueva Reserva';
        if (this.reservationForm.contains('status') && this.userRole !== Rol.ADMIN) {
            this.reservationForm.removeControl('status');
        }
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  canAccessForm(): boolean {
    if (!this.userRole) return false;
    
    return [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE].includes(this.userRole);
  }


  canEditThisReservation(reservationOwnerId?: string): boolean {
    if (!this.userRole || !this.currentUser) return false;
    if (this.userRole === Rol.ADMIN) return true; 
    return this.currentUser.id === reservationOwnerId;
  }

  async loadReservationData(id: string) {
    this.isLoading = true; 
    this.cdr.detectChanges();
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos de la reserva...' });
    await loading.present();

    this.reservationService.getReservationById(id)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          loading.dismiss();
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (reservation) => {
          console.log("ReservationFormPage: Datos de reserva para editar:", reservation);
          if (!this.canEditThisReservation(reservation.userId)) {
            this.presentToast('No tienes permiso para editar esta reserva.', 'danger');
            this.navCtrl.navigateBack('/app/reservations');
            return;
          }

          const patchData: any = {
            classroomId: reservation.classroomId || (reservation.classroom ? reservation.classroom.id : null),
            startTime: reservation.startTime,
            endTime: reservation.endTime,
            purpose: reservation.purpose,
            userId: this.userRole === Rol.ADMIN ? reservation.userId : this.currentUser?.id,
          };
          
          if (this.userRole === Rol.ADMIN) {
            if (this.reservationForm.get('status')) { 
                patchData.status = reservation.status;
                this.reservationForm.get('status')?.enable();
            }
          } else {
             if (this.reservationForm.get('status')) this.reservationForm.get('status')?.disable();
          }
          this.reservationForm.patchValue(patchData);
          if (patchData.startTime) {
            this.minEndDateValue = patchData.startTime;
          }
        },
        error: async (err: Error) => { 
          await this.presentToast(err.message || 'Error al cargar datos de la reserva.', 'danger');
          this.navCtrl.navigateBack('/app/reservations');
        }
      });
  }

  async onSubmit() {
    console.log("ReservationFormPage: onSubmit - Formulario:", this.reservationForm.value);
    console.log("ReservationFormPage: onSubmit - Validez:", this.reservationForm.valid);
    
    Object.keys(this.reservationForm.controls).forEach(key => {
        const controlErrors = this.reservationForm.get(key)?.errors;
        if (controlErrors != null) {
            console.log('Errores en control ' + key + ':', controlErrors);
        }
    });
    if (this.reservationForm.errors) {
        console.log('Errores a nivel de FormGroup:', this.reservationForm.errors);
    }

    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      await this.presentToast('Por favor, completa todos los campos requeridos y corrige los errores.', 'warning');
      return;
    }

    this.isLoading = true; 
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando reserva...' : 'Creando reserva...' });
    await loading.present();

    const formValue = this.reservationForm.getRawValue();
    const reservationData: Partial<Reservation> = {
        classroomId: formValue.classroomId,
        userId: (this.userRole === Rol.ADMIN && formValue.userId) ? formValue.userId : this.currentUser?.id,
        startTime: new Date(formValue.startTime).toISOString(),
        endTime: new Date(formValue.endTime).toISOString(),
        purpose: formValue.purpose,
       
        status: (this.isEditMode && this.userRole === Rol.ADMIN && this.reservationForm.get('status')) ? formValue.status : undefined
    };
    
    if (!this.isEditMode) { 
        delete reservationData.status;
    }

    if (!reservationData.userId) {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast('Error: No se pudo determinar el ID del usuario.', 'danger');
        return;
    }

    let operation: Observable<Reservation | void>;

    if (this.isEditMode && this.reservationId) {
      operation = this.reservationService.updateReservation(this.reservationId, reservationData);
    } else {
      const createPayload: Omit<Reservation, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'user' | 'classroom'> = {
        classroomId: reservationData.classroomId!,
        userId: reservationData.userId!,
        startTime: reservationData.startTime!,
        endTime: reservationData.endTime!,
        purpose: reservationData.purpose
      };
      operation = this.reservationService.createReservation(createPayload);
    }

    operation.pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
            this.isLoading = false;
            await loading.dismiss();
            this.cdr.detectChanges();
        })
    ).subscribe({
      next: async () => {
        const successMsg = `Reserva ${this.isEditMode ? 'actualizada' : 'solicitada exitosamente'}. Quedará pendiente de aprobación.`;
        await this.presentToast(successMsg, 'success');
        this.navCtrl.navigateBack('/app/reservations', { animated: true });
      },
      error: async (err: Error) => { 
        await this.presentToast(err.message || 'Error al guardar la reserva.', 'danger');
      }
    });
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3500, color, position: 'top', icon: iconName });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/reservations', { animated: true });
  }
}
