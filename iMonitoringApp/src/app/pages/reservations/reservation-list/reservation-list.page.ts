import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationService } from '../../../services/reservation.service';
import { Reservation, ReservationStatus } from '../../../models/reservation.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { User } from '../../../models/user.model';
import { Observable, Subject, combineLatest, of } from 'rxjs';
import { takeUntil, switchMap, filter, tap, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-reservation-list',
  templateUrl: './reservation-list.page.html',
  styleUrls: ['./reservation-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FormsModule],
  providers: [DatePipe]
})
export class ReservationListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  reservations: Reservation[] = [];
  isLoading = false;
  
  pendingReservations: Reservation[] = [];
  isLoadingPending = false;
  showPendingSection = false;

  currentUser: User | null = null;
  userRole: Rol | null = null;
  errorMessage: string = '';

  filterStatus: ReservationStatus | '' = '';
  allStatusesForFilter = [
    { value: '', display: 'Todas (Excepto Pendientes por Botón)' },
    { value: ReservationStatus.CONFIRMADA, display: 'Confirmadas' },
    { value: ReservationStatus.RECHAZADA, display: 'Rechazadas' },
    { value: ReservationStatus.CANCELADA, display: 'Canceladas' },
  ];

  public RolEnum = Rol;
  public ReservationStatusEnum = ReservationStatus;

  constructor(
    private reservationService: ReservationService,
    private authService: AuthService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef,
    public datePipe: DatePipe
  ) {}

  ngOnInit() {
    console.log("ReservationListPage: ngOnInit");
    combineLatest([
      this.authService.getCurrentUserRole(),
      this.authService.getCurrentUser()
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([role, user]) => role !== null && user !== null)
    ).subscribe(([role, user]: [Rol | null, User | null]) => {
      this.userRole = role;
      this.currentUser = user;
      this.cdr.detectChanges();
    });
  }

  ionViewWillEnter() {
    console.log("ReservationListPage: ionViewWillEnter - Cargando reservaciones principales");
    this.loadReservations();
    if (this.userRole === Rol.ADMIN && this.showPendingSection) {
        this.loadPendingReservations();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadReservations(event?: CustomEvent) {
    if (!this.userRole || !this.currentUser?.id) {
        if (event && event.target) (event.target as unknown as IonRefresher).complete();
        this.isLoading = false;
        this.cdr.detectChanges();
        return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    let loadingOverlay: HTMLIonLoadingElement | undefined;
    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando reservas...' });
      await loadingOverlay.present();
    }
    const filters: { status?: ReservationStatus, userId?: string } = {};
    if (this.filterStatus) filters.status = this.filterStatus;
    if (this.userRole !== Rol.ADMIN) filters.userId = this.currentUser.id;
    
    this.reservationService.getAllReservations(filters)
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
            this.isLoading = false;
            if (loadingOverlay) await loadingOverlay.dismiss();
            if (event && event.target) (event.target as unknown as IonRefresher).complete();
            this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data: Reservation[]) => this.reservations = data,
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar reservas.';
          await this.presentToast(this.errorMessage, 'danger');
        }
      });
  }
  
  async togglePendingSection() {
    this.showPendingSection = !this.showPendingSection;
    if (this.showPendingSection && this.userRole === Rol.ADMIN) {
      this.loadPendingReservations();
    }
    this.cdr.detectChanges();
  }

  async loadPendingReservations(event?: CustomEvent) {
    if (this.userRole !== Rol.ADMIN) return;
    this.isLoadingPending = true;
    this.errorMessage = '';
    let loadingOverlay: HTMLIonLoadingElement | undefined;
    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando reservas pendientes...' });
      await loadingOverlay.present();
    }
    this.reservationService.getAllReservations({ status: ReservationStatus.PENDIENTE })
      .pipe(
        takeUntil(this.destroy$),
        finalize(async () => {
            this.isLoadingPending = false;
            if (loadingOverlay) await loadingOverlay.dismiss();
            if (event && event.target) (event.target as unknown as IonRefresher).complete();
            this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (data: Reservation[]) => this.pendingReservations = data,
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar reservas pendientes.';
          await this.presentToast(this.errorMessage, 'danger');
        }
      });
  }

  onFilterChange() { this.loadReservations(); }
  canCreateReservation(): boolean { return !!this.userRole && [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR, Rol.ESTUDIANTE].includes(this.userRole); }
  canEditReservation(reservation: Reservation): boolean { 
    if (this.userRole === Rol.ADMIN) return true;
    return !!(this.currentUser && reservation.userId === this.currentUser.id && reservation.status === ReservationStatus.PENDIENTE);
  }
  canManageStatus(reservation: Reservation): boolean { return this.userRole === Rol.ADMIN && reservation.status === ReservationStatus.PENDIENTE; }
  canCancelReservation(reservation: Reservation): boolean { 
    if (this.userRole === Rol.ADMIN) return true;
    return !!(this.currentUser && reservation.userId === this.currentUser.id && 
        (reservation.status === ReservationStatus.PENDIENTE || reservation.status === ReservationStatus.CONFIRMADA));
  }
  navigateToAddReservation() { this.navCtrl.navigateForward('/app/reservations/new'); }
  navigateToEditReservation(reservationId?: string) { if (reservationId) this.navCtrl.navigateForward(`/app/reservations/edit/${reservationId}`); }

  async confirmAction(reservation: Reservation, actionType: 'approve' | 'reject' | 'cancel', listType: 'main' | 'pending') {
    let newStatus: ReservationStatus | undefined;
    let actionText: string = actionType;

    if (actionType === 'approve') newStatus = ReservationStatus.CONFIRMADA;
    else if (actionType === 'reject') newStatus = ReservationStatus.RECHAZADA;
    else if (actionType === 'cancel') newStatus = ReservationStatus.CANCELADA;
    else return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Acción',
      message: `¿Estás seguro de que quieres ${actionText} esta reserva?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Sí',
          cssClass: (actionType === 'reject' || actionType === 'cancel') ? 'text-kwd-red' : 'text-kwd-green',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Procesando...' });
            await loading.present();
            let serviceCall: Observable<Reservation | void>;

            if (actionType === 'cancel') {
              serviceCall = this.reservationService.cancelMyReservation(reservation.id!);
            } else {
              serviceCall = this.reservationService.updateReservationStatus(reservation.id!, newStatus as ReservationStatus.CONFIRMADA | ReservationStatus.RECHAZADA);
            }
            serviceCall.pipe(takeUntil(this.destroy$), finalize(async () => await loading.dismiss()))
              .subscribe({
                next: async () => {
                  await this.presentToast(`Reserva ${actionText}a exitosamente.`, 'success');
                  if (listType === 'pending') this.loadPendingReservations();
                  this.loadReservations(); 
                },
                error: async (err: Error) => await this.presentToast(err.message || `Error al ${actionText} la reserva.`, 'danger')
              });
          },
        },
      ],
    });
    await alert.present();
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', icon: iconName });
    await toast.present();
  }
  handleRefresh(event: CustomEvent) { this.loadReservations(event); if (this.userRole === Rol.ADMIN && this.showPendingSection) this.loadPendingReservations(); }
}
