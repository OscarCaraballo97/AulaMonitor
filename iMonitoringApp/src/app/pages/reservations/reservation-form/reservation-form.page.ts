import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSpinner,
  IonItem,
  IonLabel,
  IonSelect, 
  IonSelectOption,
  IonInput,
  IonButton,
  IonTextarea,
  LoadingController,
  ToastController,
  NavController,
  AlertController
} from '@ionic/angular/standalone';
import { ReservationService, ReservationCreationData } from '../../../services/reservation.service';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models/user.model';
import { Observable, Subject, forkJoin, of, combineLatest } from 'rxjs';
import { takeUntil, catchError, tap, finalize, take, switchMap, map, distinctUntilChanged, startWith, filter } from 'rxjs/operators';
import { Rol } from 'src/app/models/rol.model';

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
          endControl.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
    }
    return null;
  };
}

interface SelectableDate {
  value: string; 
  display: string; 
}

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.page.html',
  styleUrls: ['./reservation-form.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonSpinner,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonInput,
    IonButton,
    IonTextarea
  ],
  providers: [DatePipe]
})
export class ReservationFormPage implements OnInit, OnDestroy {
  @ViewChild('classroomSelectControl') classroomSelectControl!: IonSelect;

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

  selectableDates: SelectableDate[] = [];
  selectedDateForTimeSlots: string = ''; 
  availableStartTimes: { value: string, display: string }[] = [];
  isLoadingTimes = false;
  existingReservationsForDay: Reservation[] = [];
  reservationDurationHours = 1;
  public reservationOwnerName: string | null = null;

  private activeElementBeforeOverlay: HTMLElement | null = null;

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
    public datePipe: DatePipe
  ) {
    this.generateSelectableDates();
  }

  generateSelectableDates() {
    const dates: SelectableDate[] = [];
    const todayForIteration = new Date(); 

    for (let i = 0; i < 30; i++) { 
      const currentDateLocal = new Date(todayForIteration);
      currentDateLocal.setDate(todayForIteration.getDate() + i);
      currentDateLocal.setHours(0, 0, 0, 0); 

      if (currentDateLocal.getDay() !== 0) { 
        const dateValueUTCString = new Date(Date.UTC(
            currentDateLocal.getFullYear(), 
            currentDateLocal.getMonth(), 
            currentDateLocal.getDate()
        )).toISOString();
        
        dates.push({
          value: dateValueUTCString, 
          display: this.datePipe.transform(currentDateLocal, 'EEEE, d \'de\' MMMM \'de\' y', undefined, 'es-CO') || ''
        });
      }
    }
    this.selectableDates = dates;
  }

  ngOnInit() {
    this.initializeForm();
    this.loadInitialData();
    this.setupFormListeners();
  }

  ionViewDidEnter() {
    if (!this.isLoadingInitialData && this.classroomSelectControl) {
      console.log('ReservationFormPage: ionViewDidEnter, intentando enfocar selector de aula.');
      setTimeout(() => { 
        if (typeof (this.classroomSelectControl as any).setFocus === 'function') {
            (this.classroomSelectControl as any).setFocus();
        } else {
            const el = (this.classroomSelectControl as any).el as HTMLElement;
            const button = el.querySelector('button') || el; 
             if(button instanceof HTMLElement) button.focus();
        }
      }, 300);
    }
  }

  private storeActiveElement() {
    if (document.activeElement && document.activeElement !== document.body) {
      this.activeElementBeforeOverlay = document.activeElement as HTMLElement;
    } else {
      this.activeElementBeforeOverlay = null;
    }
  }

  private blurActiveElement() {
    if (document.activeElement && typeof (document.activeElement as HTMLElement).blur === 'function' && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }
  }

  private restoreActiveElement() {
    if (this.activeElementBeforeOverlay && typeof this.activeElementBeforeOverlay.focus === 'function') {
      setTimeout(() => {
        this.activeElementBeforeOverlay?.focus();
        this.activeElementBeforeOverlay = null;
      }, 150); 
    }
  }

  initializeForm() {
    let defaultDateISOForControl = '';
    if (this.selectableDates.length > 0) {
      defaultDateISOForControl = this.selectableDates[0].value;
      this.selectedDateForTimeSlots = this.datePipe.transform(new Date(defaultDateISOForControl), 'yyyy-MM-dd', 'UTC')!;
    } else {
      console.warn('No hay fechas seleccionables generadas para el selector.');
      const todayForFallback = new Date();
      defaultDateISOForControl = new Date(Date.UTC(todayForFallback.getFullYear(), todayForFallback.getMonth(), todayForFallback.getDate())).toISOString();
      this.selectedDateForTimeSlots = this.datePipe.transform(todayForFallback, 'yyyy-MM-dd', 'UTC')!;
    }

    this.reservationForm = this.fb.group({
      classroomId: [null, Validators.required],
      userId: [{ value: null, disabled: true }],
      reservationDateControl: [defaultDateISOForControl, Validators.required],
      startTime: [null, Validators.required],
      endTime: [{ value: null, disabled: true }, Validators.required],
      status: [{ value: ReservationStatus.PENDIENTE, disabled: true }, Validators.required],
      purpose: ['', Validators.maxLength(255)],
    }, { validators: dateTimeOrderValidator() });
  }

  loadInitialData() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();
    forkJoin({
      user: this.authService.getCurrentUser().pipe(take(1)),
      role: this.authService.getCurrentUserRole().pipe(take(1)),
      classroomsData: this.classroomService.getAllClassrooms().pipe(
        catchError(err => {
          console.error("Error loading classrooms:", err);
          this.presentToast('Error al cargar las aulas', 'danger');
          return of([] as Classroom[]);
        })
      )
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoadingInitialData = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (results) => {
        this.currentUser = results.user;
        this.userRole = results.role;
        this.classrooms = results.classroomsData;

        this.reservationId = this.route.snapshot.paramMap.get('id');
        this.isEditMode = !!this.reservationId;
        this.pageTitle = this.isEditMode ? 'Editar Reserva' : 'Nueva Reserva';
        
        this.configureFormBasedOnRoleAndMode(); 

        if (this.isEditMode && this.reservationId) {
          this.loadReservationData(this.reservationId);
        } else {
           if (this.reservationForm.get('classroomId')?.value && this.reservationForm.get('reservationDateControl')?.value) {
             this.reservationForm.get('classroomId')?.updateValueAndValidity({ emitEvent: true });
           }
        }
      },
      error: (err) => {
        console.error("Error loading initial data:", err);
        this.presentToast('Error al cargar datos del formulario', 'danger');
      }
    });
  }

  setupFormListeners() {
     combineLatest([
      this.reservationForm.get('classroomId')!.valueChanges.pipe(
        startWith(this.reservationForm.get('classroomId')?.value), 
        distinctUntilChanged()
      ),
      this.reservationForm.get('reservationDateControl')!.valueChanges.pipe(
        startWith(this.reservationForm.get('reservationDateControl')?.value), 
        tap(selectedDateISO_UTC => { 
          if (selectedDateISO_UTC) {
            this.selectedDateForTimeSlots = this.datePipe.transform(selectedDateISO_UTC, 'yyyy-MM-dd', 'UTC')!;
            console.log('Nueva fecha seleccionada (YYYY-MM-DD de UTC):', this.selectedDateForTimeSlots); 
            
            this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
            this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
            this.availableStartTimes = [];
          }
        }),
        map(selectedDateISO_UTC => { 
          if (!selectedDateISO_UTC) return null;
          return this.datePipe.transform(selectedDateISO_UTC, 'yyyy-MM-dd', 'UTC');
        }),
        distinctUntilChanged()
      )
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([classroomId, dateStr_UTC]) => { 
        return !!classroomId && !!dateStr_UTC;
      }),
      switchMap(([classroomId, dateStr_UTC]) => { 
        this.isLoadingTimes = true;
        this.cdr.detectChanges();
        const parts = dateStr_UTC!.split('-').map(Number);
        const dayStartUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0)).toISOString();
        const dayEndUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)).toISOString();
        console.log(`[API Call] Fetching reservations for classroom ${classroomId} from ${dayStartUTC} to ${dayEndUTC}`);
        return this.classroomService.getClassroomReservations(classroomId, dayStartUTC, dayEndUTC).pipe(
          catchError(err => {
            console.error("Error cargando reservaciones para el día:", err);
            this.presentToast('Error al cargar horarios disponibles', 'danger');
            return of([] as Reservation[]);
          }),
          finalize(() => {
            this.isLoadingTimes = false;
            this.cdr.detectChanges();
          })
        );
      })
    ).subscribe((newlyFetchedReservations: Reservation[]) => { 
      this.existingReservationsForDay = newlyFetchedReservations;
      this.generateAvailableTimeSlots(newlyFetchedReservations);
    });
  }

  generateAvailableTimeSlots(currentDayReservations?: Reservation[]) {
    const reservationsToUse = currentDayReservations || this.existingReservationsForDay;

    if (!this.selectedDateForTimeSlots || !this.reservationForm.get('classroomId')?.value) {
      this.availableStartTimes = [];
      this.cdr.detectChanges();
      return;
    }
    console.log(`Generando slots para fecha (interpretada como UTC): ${this.selectedDateForTimeSlots}`);
    const slots: { value: string, display: string }[] = [];
    const openingHour = 7; 
    let dayClosingHour = 22; 

    const dateParts = this.selectedDateForTimeSlots.split('-').map(Number);
    const selectedDateObjectForDisplay = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
    
    const dayOfWeek = selectedDateObjectForDisplay.getDay(); 

    if (dayOfWeek === 6) { dayClosingHour = 12; } 
    else if (dayOfWeek === 0) { 
      this.availableStartTimes = [];
      this.cdr.detectChanges();
      return;
    }

    const now = new Date(); 
    const todayLocalDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isSelectedDateToday = selectedDateObjectForDisplay.getTime() === todayLocalDate.getTime();

    for (let hour = openingHour; hour < dayClosingHour; hour++) {
      const slotStartLocal = new Date(selectedDateObjectForDisplay); 
      slotStartLocal.setHours(hour, 0, 0, 0); 

      if (isSelectedDateToday && slotStartLocal.getTime() < now.getTime()) {
        continue;
      }
      
      const slotStartUTCValue = slotStartLocal.toISOString(); 

      const slotEndLocal = new Date(slotStartLocal);
      slotEndLocal.setHours(slotStartLocal.getHours() + this.reservationDurationHours, 0, 0, 0);
      const slotEndUTCForCheck = slotEndLocal.toISOString(); 
      
      let isDisabled = false;
      for (const reservation of reservationsToUse) { 
        const existingStartUTC = new Date(reservation.startTime);
        const existingEndUTC = new Date(reservation.endTime);
        if (this.isEditMode && this.reservationId === reservation.id) continue;

        if (new Date(slotStartUTCValue) < existingEndUTC && new Date(slotEndUTCForCheck) > existingStartUTC) {
          isDisabled = true;
          break;
        }
      }

      if (!isDisabled) {
        slots.push({
          value: slotStartUTCValue, 
          display: this.datePipe.transform(slotStartLocal, 'HH:mm', undefined, 'es-CO')!,
        });
      }
    }
    this.availableStartTimes = slots as { value: string; display: string; disabled: boolean; }[];
    this.cdr.detectChanges();
  }

  onStartTimeSelected(selectedStartTimeISO_UTC: string) {
    if (!selectedStartTimeISO_UTC || this.isLoadingTimes) return;
    const startTimeUTC = new Date(selectedStartTimeISO_UTC);
    const endTimeUTC = new Date(startTimeUTC.getTime() + this.reservationDurationHours * 60 * 60 * 1000);
    this.reservationForm.get('startTime')?.setValue(startTimeUTC.toISOString());
    this.reservationForm.get('endTime')?.setValue(endTimeUTC.toISOString());
    this.cdr.detectChanges();
  }

  configureFormBasedOnRoleAndMode() {
    if (this.userRole === Rol.ADMIN) {
      this.reservationForm.get('userId')?.enable({ emitEvent: false });
      this.reservationForm.get('status')?.enable({ emitEvent: false });
      if (!this.isEditMode) { 
        this.reservationForm.patchValue({ status: ReservationStatus.PENDIENTE }, { emitEvent: false });
      }
    } else { 
      this.reservationForm.get('userId')?.disable({ emitEvent: false });
      this.reservationForm.get('status')?.disable({ emitEvent: false }); 
      if (this.currentUser?.id) {
        this.reservationForm.patchValue({ userId: this.currentUser.id }, { emitEvent: false });
      }
       if (!this.isEditMode) {
         this.reservationForm.patchValue({ status: ReservationStatus.PENDIENTE }, { emitEvent: false });
       }
    }
    this.cdr.detectChanges();
  }

  async loadReservationData(id: string) {
    this.isLoading = true;
    this.reservationOwnerName = null; 
    this.storeActiveElement();
    this.blurActiveElement();
    const loading = await this.loadingCtrl.create({ message: 'Cargando reserva...' });
    await loading.present();

    this.reservationService.getReservationById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        try { await loading.dismiss(); } catch (e) { console.warn('Error dismissing loading', e); }
        this.restoreActiveElement();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (reservation) => { 
        if (!this.canEditThisReservation(reservation.status, reservation.userId)) {
          this.presentToast('No autorizado para editar esta reserva.', 'danger');
          this.navCtrl.navigateBack('/app/reservations');
          return;
        }
        
        this.reservationOwnerName = reservation.user?.name ?? null;
        
        const startTimeUTC = new Date(reservation.startTime);
        const reservationDateAtUTCMidnightISO = new Date(Date.UTC(startTimeUTC.getUTCFullYear(), startTimeUTC.getUTCMonth(), startTimeUTC.getUTCDate())).toISOString();
        
        this.reservationForm.get('reservationDateControl')?.setValue(reservationDateAtUTCMidnightISO, { emitEvent: false }); 
        this.selectedDateForTimeSlots = this.datePipe.transform(startTimeUTC, 'yyyy-MM-dd', 'UTC')!;

        this.reservationForm.patchValue({
          classroomId: reservation.classroomId,
          purpose: reservation.purpose,
        }, { emitEvent: false }); 

        if (this.userRole === Rol.ADMIN) {
          this.reservationForm.patchValue({
            userId: reservation.userId,
            status: reservation.status
          }, { emitEvent: false });
        } else {
            this.reservationForm.get('status')?.setValue(reservation.status, {emitEvent: false});
        }

        const classroomIdForSlots = this.reservationForm.get('classroomId')?.value;
        if (classroomIdForSlots && this.selectedDateForTimeSlots) {
            const parts = this.selectedDateForTimeSlots.split('-').map(Number); 
            const dayStartUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0)).toISOString();
            const dayEndUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)).toISOString();

            this.classroomService.getClassroomReservations(classroomIdForSlots, dayStartUTC, dayEndUTC)
            .pipe(takeUntil(this.destroy$))
            .subscribe(reservationsForDay => {
                this.generateAvailableTimeSlots(reservationsForDay);
                
                const targetStartTimeISO = reservation.startTime; 
                const matchingSlot = this.availableStartTimes.find(slot => slot.value === targetStartTimeISO);

                if(matchingSlot) { 
                    this.reservationForm.get('startTime')?.setValue(targetStartTimeISO, { emitEvent: false }); 
                    this.reservationForm.get('endTime')?.setValue(reservation.endTime, { emitEvent: false });  
                } else {
                    console.warn("El slot original de la reserva ya no está disponible o no se encontró. La hora no se preseleccionará.");
                    this.reservationForm.get('startTime')?.setValue(null, { emitEvent: false });
                    this.reservationForm.get('endTime')?.setValue(null, { emitEvent: false });
                     if(this.isEditMode) { 
                        this.presentToast('El horario original de esta reserva ya no está disponible. Por favor, selecciona uno nuevo.', 'warning', 'alert-circle-outline');
                    }
                }
                this.cdr.detectChanges();
            });
        }
      },
      error: async (err) => {
        await this.presentToast('Error al cargar la reserva.', 'danger');
        this.navCtrl.navigateBack('/app/reservations');
      }
    });
  }

  async onSubmit() {
    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }
    this.isLoading = true;
    this.storeActiveElement();
    this.blurActiveElement();
    const loading = await this.loadingCtrl.create({
      message: this.isEditMode ? 'Actualizando reserva...' : 'Creando reserva...'
    });
    await loading.present();

    const formValue = this.reservationForm.getRawValue();
    const reservationDataPayload: Partial<Reservation> = {
      classroomId: formValue.classroomId,
      startTime: formValue.startTime, 
      endTime: formValue.endTime,     
      purpose: formValue.purpose,
    };

    if (this.userRole === Rol.ADMIN) {
      reservationDataPayload.userId = formValue.userId || this.currentUser?.id; 
      if (this.isEditMode) {
        reservationDataPayload.status = formValue.status;
      } else { 
        reservationDataPayload.status = formValue.status || ReservationStatus.PENDIENTE;
      }
    } else { 
        reservationDataPayload.userId = this.currentUser?.id;
        reservationDataPayload.status = ReservationStatus.PENDIENTE;
    }

    const operation = this.isEditMode && this.reservationId
      ? this.reservationService.updateReservation(this.reservationId, reservationDataPayload)
      : this.reservationService.createReservation(reservationDataPayload as ReservationCreationData);

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        try { await loading.dismiss(); } catch (e) { console.warn('Error dismissing loading on submit', e); }
        this.restoreActiveElement();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async () => {
        await this.presentToast(`Reserva ${this.isEditMode ? 'actualizada' : 'creada'} correctamente.`, 'success');
        this.navCtrl.navigateBack('/app/reservations', { animated: true });
      },
      error: async (err: any) => {
        const errorMessage = err?.error?.message || err?.error?.error || err?.message || `Error al ${this.isEditMode ? 'actualizar' : 'crear'} la reserva.`;
        await this.presentToast(errorMessage, 'danger');
      }
    });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    this.storeActiveElement();
    this.blurActiveElement();
    const toast = await this.toastCtrl.create({
      message,
      duration: 3500,
      color,
      position: 'top',
      icon: iconName,
      buttons: [ { text: 'OK', role: 'cancel' } ]
    });
    toast.present();
    toast.onDidDismiss().then(() => this.restoreActiveElement());
  }

  cancel() {
    this.navCtrl.navigateBack('/app/reservations', { animated: true });
  }

  canEditThisReservation(reservationStatus?: ReservationStatus, reservationOwnerId?: string): boolean {
    if (!this.userRole || !this.currentUser) {
      return false;
    }
    if (this.userRole === Rol.ADMIN) {
      return true;
    }
    const isOwnReservation = this.currentUser.id === reservationOwnerId;
    if (!isOwnReservation) {
      return false;
    }
    if (this.isEditMode) {
        return reservationStatus === ReservationStatus.PENDIENTE;
    }
    return true; 
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}