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
import { takeUntil, catchError } from 'rxjs/operators';


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
  }

  ngOnInit() {
    const now = new Date();
    const defaultStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0);
    const defaultEndTime = new Date(defaultStartTime.getTime() + (60 * 60 * 1000));

    this.reservationForm = this.fb.group({
      classroomId: [null, Validators.required],
      userId: [null],
      startTime: [defaultStartTime.toISOString(), Validators.required],
      endTime: [defaultEndTime.toISOString(), Validators.required],
      purpose: ['', Validators.maxLength(255)],
      status: [ReservationStatus.PENDIENTE, Validators.required]
    }, { validators: dateTimeOrderValidator() });

    this.reservationForm.get('startTime')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(value => {
      this.minEndDateValue = value || this.minDateValue;
      this.cdr.detectChanges();
    });

    forkJoin([
      this.authService.getCurrentUser().pipe(takeUntil(this.destroy$)),
      this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)),
      this.classroomService.getAllClassrooms().pipe(takeUntil(this.destroy$), catchError(() => of([] as Classroom[])))
    ]).subscribe(([user, role, classrooms]) => {
      this.currentUser = user;
      this.userRole = role;
      this.classrooms = classrooms;

      if (!this.isUserAllowedToManage()) {
        this.presentToast('Acceso denegado.', 'danger');
        this.navCtrl.navigateBack('/app/dashboard');
        return;
      }

      if (this.userRole !== Rol.ADMIN && this.currentUser?.id) {
        this.reservationForm.patchValue({ userId: this.currentUser.id });
        this.reservationForm.get('userId')?.disable();
        this.reservationForm.get('status')?.disable();
      } else if (this.userRole === Rol.ADMIN) {
        this.reservationForm.get('userId')?.enable();
        this.reservationForm.get('status')?.enable();
      }

      this.reservationId = this.route.snapshot.paramMap.get('id');
      if (this.reservationId) {
        this.isEditMode = true;
        this.pageTitle = 'Editar Reserva';
        this.loadReservationData(this.reservationId);
      } else {
        this.pageTitle = 'Nueva Reserva';
        if (this.userRole !== Rol.ADMIN) {
          this.reservationForm.patchValue({status: ReservationStatus.PENDIENTE});
        }
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isUserAllowedToManage(): boolean {
    if (!this.userRole) return false;
    return [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR].includes(this.userRole);
  }

  async loadReservationData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos de la reserva...' });
    await loading.present();
    this.reservationService.getReservationById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (reservation) => {
          const patchData: any = { ...reservation };
          if (this.userRole !== Rol.ADMIN) {
            patchData.userId = this.currentUser?.id; 
            this.reservationForm.get('userId')?.disable();
            this.reservationForm.get('status')?.disable();
          } else {
            this.reservationForm.get('userId')?.enable();
            this.reservationForm.get('status')?.enable();
          }
          this.reservationForm.patchValue(patchData);
         
          if (patchData.startTime) {
            this.minEndDateValue = patchData.startTime;
          }
          this.isLoading = false;
          loading.dismiss();
        },
        error: async (err) => {
          this.isLoading = false;
          await loading.dismiss();
          await this.presentToast(err.message || 'Error al cargar datos de la reserva.', 'danger');
          this.navCtrl.navigateBack('/app/reservations');
        }
      });
  }

  async onSubmit() {
  
    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      await this.presentToast('Por favor, completa todos los campos requeridos y corrige los errores.', 'warning');
      return;
    }
    if (!this.isUserAllowedToManage()) {
      await this.presentToast('No tienes permiso para realizar esta acción.', 'danger');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando reserva...' : 'Creando reserva...' });
    await loading.present();

    const formValue = this.reservationForm.getRawValue();
    const reservationData: Partial<Reservation> = {
        classroomId: formValue.classroomId,
        userId: this.userRole === Rol.ADMIN ? formValue.userId : (this.currentUser?.id || formValue.userId),
        startTime: new Date(formValue.startTime).toISOString(),
        endTime: new Date(formValue.endTime).toISOString(),
        purpose: formValue.purpose,
        status: formValue.status
    };

    if (!reservationData.userId) {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast('Error: No se pudo determinar el ID del usuario.', 'danger');
        return;
    }

    let operation: Observable<Reservation | void>;

    if (this.isEditMode && this.reservationId) {
      const updateData = {...reservationData};
      if (this.userRole !== Rol.ADMIN) {
        delete updateData.status;
      }
      operation = this.reservationService.updateReservation(this.reservationId, updateData);
    } else {
      if (this.userRole !== Rol.ADMIN) {
        reservationData.status = ReservationStatus.PENDIENTE;
      }
      operation = this.reservationService.createReservation(reservationData as Omit<Reservation, 'id'>);
    }

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        const successMsg = `Reserva ${this.isEditMode ? 'actualizada' : 'creada'} correctamente.`;
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast(successMsg, 'success');
        this.navCtrl.navigateBack('/app/reservations', { animated: true });
      },
      error: async (err) => {
        this.isLoading = false;
        await loading.dismiss();
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
