import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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
  IonDatetime,
  IonDatetimeButton,
  IonModal,
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
import { User,} from '../../../models/user.model';
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
    IonDatetime,
    IonDatetimeButton,
    IonModal,
    IonButton,
    IonTextarea
  ],
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
  maxDateValue: string;
  selectedDateForTimeSlots: string = '';
  availableStartTimes: { value: string, display: string, disabled: boolean }[] = [];
  isLoadingTimes = false;
  existingReservationsForDay: Reservation[] = [];
  reservationDurationHours = 1;

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
    const now = new Date();
    this.minDateValue = this.datePipe.transform(now, 'yyyy-MM-dd')!;
    this.minEndDateValue = this.minDateValue;
    const maxDate = new Date();
    maxDate.setDate(now.getDate() + 30);
    this.maxDateValue = this.datePipe.transform(maxDate, 'yyyy-MM-dd')!;
  }

  isDateEnabled = (dateIsoString: string): boolean => {
    const date = new Date(dateIsoString);
    return date.getUTCDay() !== 0;
  };

  ngOnInit() {
    this.initializeForm();
    this.loadInitialData();
    this.setupFormListeners();
  }

  initializeForm() {
    let defaultDate = new Date();
    if (defaultDate.getHours() >= 22 || defaultDate.getHours() < 7) {
      if (defaultDate.getHours() >= 22) defaultDate.setDate(defaultDate.getDate() + 1);
      defaultDate.setHours(7, 0, 0, 0);
    }
    while (defaultDate.getDay() === 0) {
      defaultDate.setDate(defaultDate.getDate() + 1);
      defaultDate.setHours(7, 0, 0, 0);
    }

    this.selectedDateForTimeSlots = this.datePipe.transform(defaultDate, 'yyyy-MM-dd')!;
    const defaultDateTimeISO = defaultDate.toISOString();

    this.reservationForm = this.fb.group({
      classroomId: [null, Validators.required],
      userId: [{ value: null, disabled: true }],
      reservationDateControl: [defaultDateTimeISO, Validators.required],
      startTime: [null, Validators.required],
      endTime: [{ value: null, disabled: true }, Validators.required],
      status: [{ value: ReservationStatus.PENDIENTE, disabled: true }, Validators.required],
      purpose: ['', Validators.maxLength(255)],
    }, { validators: dateTimeOrderValidator() });
  }

  loadInitialData() {
    this.isLoadingInitialData = true;

    forkJoin({
      user: this.authService.getCurrentUser().pipe(take(1)),
      role: this.authService.getCurrentUserRole().pipe(take(1)),
      classroomsData: this.classroomService.getAllClassrooms().pipe(
        catchError(err => {
          console.error("Error loading classrooms:", err);
          this.presentToast('Error loading classrooms', 'danger');
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
      next: (results: { user: User | null, role: Rol | null, classroomsData: Classroom[] }) => {
        this.currentUser = results.user;
        this.userRole = results.role;
        this.classrooms = results.classroomsData;

        this.reservationId = this.route.snapshot.paramMap.get('id');
        this.isEditMode = !!this.reservationId;
        this.pageTitle = this.isEditMode ? 'Editar Reserva' : 'Nueva Reserva';

        this.configureFormBasedOnRoleAndMode();

        if (this.isEditMode && this.reservationId) {
          this.loadReservationData(this.reservationId);
        }
      },
      error: (err) => {
        console.error("Error loading initial data:", err);
        this.presentToast('Error loading form data', 'danger');
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
        map(isoDateString => isoDateString ? this.datePipe.transform(new Date(isoDateString), 'yyyy-MM-dd', 'UTC') : null),
        distinctUntilChanged()
      )
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([classroomId, dateString]) => !!classroomId && !!dateString),
      switchMap(([classroomId, dateStr]) => {
        this.isLoadingTimes = true;
        this.cdr.detectChanges();

        const parts = dateStr!.split('-').map(Number);
        const dayStartUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 0, 0, 0)).toISOString();
        const dayEndUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999)).toISOString();

        return this.classroomService.getClassroomReservations(classroomId, dayStartUTC, dayEndUTC).pipe(
          catchError(err => {
            console.error("Error loading reservations:", err);
            this.presentToast('Error loading available times', 'danger');
            return of([] as Reservation[]);
          }),
          finalize(() => {
            this.isLoadingTimes = false;
            this.cdr.detectChanges();
          })
        );
      })
    ).subscribe((reservations: Reservation[]) => {
      this.existingReservationsForDay = reservations;
      this.generateAvailableTimeSlots();
    });
  }

  generateAvailableTimeSlots() {
    if (!this.selectedDateForTimeSlots || !this.reservationForm.get('classroomId')?.value) {
      this.availableStartTimes = [];
      this.cdr.detectChanges();
      return;
    }

    const slots: { value: string, display: string, disabled: boolean }[] = [];
    const openingHour = 7;
    let dayClosingHour = 22;

    const parts = this.selectedDateForTimeSlots.split('-').map(Number);
    const selectedDateObject = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    const dayOfWeek = selectedDateObject.getUTCDay();

    if (dayOfWeek === 6) {
      dayClosingHour = 12;
    } else if (dayOfWeek === 0) {
      this.availableStartTimes = [];
      this.cdr.detectChanges();
      return;
    }

    const today = new Date();
    const todayDateStr = this.datePipe.transform(today, 'yyyy-MM-dd', 'UTC');
    const isSelectedDateToday = this.selectedDateForTimeSlots === todayDateStr;

    for (let hour = openingHour; hour < dayClosingHour; hour++) {
      const slotStartTimeUTC = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], hour, 0, 0, 0));

      if (isSelectedDateToday) {
        const nowLocal = new Date();
        const slotLocal = new Date(this.selectedDateForTimeSlots + `T${hour.toString().padStart(2, '0')}:00:00`);
        if (slotLocal < nowLocal) {
          continue;
        }
      }

      const slotEndTimeUTC = new Date(slotStartTimeUTC.getTime() + this.reservationDurationHours * 60 * 60 * 1000);

      let isDisabled = false;
      for (const reservation of this.existingReservationsForDay) {
        const existingStart = new Date(reservation.startTime);
        const existingEnd = new Date(reservation.endTime);

        if (this.isEditMode && this.reservationId === reservation.id) {
          continue;
        }
        if (slotStartTimeUTC < existingEnd && slotEndTimeUTC > existingStart) {
          isDisabled = true;
          break;
        }
      }

      slots.push({
        value: slotStartTimeUTC.toISOString(),
        display: this.datePipe.transform(slotStartTimeUTC, 'HH:mm', 'UTC', 'es-CO') || `${hour.toString().padStart(2, '0')}:00`,
        disabled: isDisabled
      });
    }

    this.availableStartTimes = slots;
    this.cdr.detectChanges();
  }

  onStartTimeSelected(selectedStartTimeISO: string) {
    if (!selectedStartTimeISO || this.isLoadingTimes) return;

    const startTime = new Date(selectedStartTimeISO);
    const endTime = new Date(startTime.getTime() + this.reservationDurationHours * 60 * 60 * 1000);

    this.reservationForm.get('startTime')?.setValue(startTime.toISOString());
    this.reservationForm.get('endTime')?.setValue(endTime.toISOString());

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
      this.reservationForm.patchValue({ status: ReservationStatus.PENDIENTE }, { emitEvent: false });
    }
    this.cdr.detectChanges();
  }

  async loadReservationData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Loading reservation...' });
    await loading.present();

    this.reservationService.getReservationById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (reservation) => {
        if (!this.canEditThisReservation(reservation.userId)) {
          this.presentToast('Not authorized to edit this reservation', 'danger');
          this.navCtrl.navigateBack('/app/reservations');
          return;
        }

        this.reservationForm.patchValue({
          classroomId: reservation.classroomId,
          reservationDateControl: reservation.startTime,
          purpose: reservation.purpose
        });

        if (this.userRole === Rol.ADMIN) {
          this.reservationForm.patchValue({
            userId: reservation.userId,
            status: reservation.status
          });
        }

        this.selectedDateForTimeSlots = this.datePipe.transform(new Date(reservation.startTime), 'yyyy-MM-dd', 'UTC') || '';
        this.configureFormBasedOnRoleAndMode();
      },
      error: async (err) => {
        await this.presentToast('Error loading reservation', 'danger');
        this.navCtrl.navigateBack('/app/reservations');
      }
    });
  }

  async onSubmit() {
    if (this.reservationForm.invalid) {
      this.markFormGroupTouched(this.reservationForm);
      await this.presentToast('Please complete all required fields', 'warning');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ 
      message: this.isEditMode ? 'Updating reservation...' : 'Creating reservation...' 
    });
    await loading.present();

    const formValue = this.reservationForm.getRawValue();
    const operation = this.isEditMode && this.reservationId
      ? this.reservationService.updateReservation(this.reservationId, {
          classroomId: formValue.classroomId,
          startTime: new Date(formValue.startTime).toISOString(),
          endTime: new Date(formValue.endTime).toISOString(),
          purpose: formValue.purpose,
          ...(this.userRole === Rol.ADMIN && {
            userId: formValue.userId,
            status: formValue.status
          })
        })
      : this.reservationService.createReservation({
          classroomId: formValue.classroomId,
          startTime: new Date(formValue.startTime).toISOString(),
          endTime: new Date(formValue.endTime).toISOString(),
          purpose: formValue.purpose
        });

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async () => {
        await this.presentToast(`Reservation ${this.isEditMode ? 'updated' : 'created'} successfully`, 'success');
        this.navCtrl.navigateBack('/app/reservations');
      },
      error: async (err) => {
        await this.presentToast(`Error ${this.isEditMode ? 'updating' : 'creating'} reservation`, 'danger');
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

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/reservations');
  }

  canEditThisReservation(reservationOwnerId?: string): boolean {
    if (!this.userRole || !this.currentUser) return false;
    return this.userRole === Rol.ADMIN || this.currentUser.id === reservationOwnerId;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}