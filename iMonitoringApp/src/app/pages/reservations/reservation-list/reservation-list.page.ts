
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
import { Subject, combineLatest, of } from 'rxjs';
import { takeUntil, switchMap, filter, tap } from 'rxjs/operators';

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


  filterStatus: ReservationStatus | '' = ReservationStatus.CONFIRMADA; 
  allStatusesForFilter = [ 
    { value: '', display: 'Todos (Excepto Pendientes por Botón)' }, 
    { value: ReservationStatus.CONFIRMADA, display: 'Confirmadas' },
    { value: ReservationStatus.RECHAZADA, display: 'Rechazadas' },
    { value: ReservationStatus.CANCELADA, display: 'Canceladas' },
   
    { value: ReservationStatus.PENDIENTE, display: 'Pendientes (en lista principal)' }
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
      filter(([role, user]) => role !== null)
    ).subscribe(([role, user]) => {
      console.log("ReservationListPage: Rol recibido ->", role);
      console.log("ReservationListPage: Usuario actual recibido ->", user);
      this.userRole = role;
      this.currentUser = user;
      this.cdr.detectChanges();
    });
  }

  ionViewWillEnter() {
    console.log("ReservationListPage: ionViewWillEnter - Cargando reservaciones principales");
    this.loadReservations(); 
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadReservations(event?: CustomEvent) {
    if ((this.userRole === Rol.ESTUDIANTE || this.userRole === Rol.TUTOR) && !this.currentUser?.id && this.filterStatus !== '') {
      console.log("ReservationListPage: loadReservations - Esperando ID de usuario para filtros específicos...");
      if (event && event.target) (event.target as unknown as IonRefresher).complete();
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
    
    if (this.filterStatus === '') {
    } else if (this.filterStatus) {
      filters.status = this.filterStatus;
    }


    if (this.userRole === Rol.ESTUDIANTE || this.userRole === Rol.TUTOR) {
      if (this.currentUser?.id) {
        filters.userId = this.currentUser.id;
        console.log(`ReservationListPage: Filtrando lista principal para userId: ${filters.userId}`);
      } else {
        console.warn("ReservationListPage: ID de usuario no disponible para filtrar lista principal.");
        this.isLoading = false;
        if (loadingOverlay) await loadingOverlay.dismiss();
        if (event && event.target) (event.target as unknown as IonRefresher).complete();
        this.reservations = [];
        this.cdr.detectChanges();
        return;
      }
    }

    this.reservationService.getAllReservations(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Reservation[]) => {
          console.log("ReservationListPage: Reservas principales recibidas ->", data);
          this.reservations = data;
        },
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar reservas.';
          console.error("ReservationListPage: Error en getAllReservations (principal) ->", err);
          await this.presentToast(this.errorMessage, 'danger');
        },
        complete: async () => {
          this.isLoading = false;
          if (loadingOverlay) await loadingOverlay.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
        }
      });
  }
  
  async togglePendingSection() {
    this.showPendingSection = !this.showPendingSection;
    if (this.showPendingSection) { 
      this.loadPendingReservations();
    }
  }

  async loadPendingReservations(event?: CustomEvent) {
    if ((this.userRole === Rol.ESTUDIANTE || this.userRole === Rol.TUTOR) && !this.currentUser?.id) {
      console.log("ReservationListPage: loadPendingReservations - Esperando ID de usuario...");
      if (event && event.target) (event.target as unknown as IonRefresher).complete();
      return;
    }

    this.isLoadingPending = true;
    let loadingOverlayPending: HTMLIonLoadingElement | undefined;
    if (!event) { 
        loadingOverlayPending = await this.loadingCtrl.create({ message: 'Cargando pendientes...' });
        await loadingOverlayPending.present();
    }

    const filters: { status: ReservationStatus, userId?: string } = { status: ReservationStatus.PENDIENTE };
    if (this.userRole === Rol.ESTUDIANTE || this.userRole === Rol.TUTOR) {
      if (this.currentUser?.id) {
        filters.userId = this.currentUser.id;
      } else {
         this.isLoadingPending = false;
         if (loadingOverlayPending) await loadingOverlayPending.dismiss();
         if (event && event.target) (event.target as unknown as IonRefresher).complete();
         this.pendingReservations = [];
         this.cdr.detectChanges();
        return;
      }
    }


    this.reservationService.getAllReservations(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: Reservation[]) => {
          console.log("ReservationListPage: Reservas PENDIENTES recibidas ->", data);
          this.pendingReservations = data;
        },
        error: async (err: Error) => {
          console.error("ReservationListPage: Error en getAllReservations (pendientes) ->", err);
          await this.presentToast(err.message || 'Error al cargar reservas pendientes.', 'danger');
        },
        complete: async () => {
          this.isLoadingPending = false;
          if (loadingOverlayPending) await loadingOverlayPending.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
        }
      });
  }


  onFilterChange() {
    this.loadReservations();
  }

  canCreateReservation(): boolean {
    if (!this.userRole) return false;
    return [Rol.ADMIN, Rol.PROFESOR, Rol.TUTOR].includes(this.userRole);
  }

  canEditReservation(reservation: Reservation): boolean {
    if (this.userRole === Rol.ADMIN) return true;
    if (this.currentUser && (this.userRole === Rol.PROFESOR || this.userRole === Rol.TUTOR) && reservation.userId === this.currentUser.id) return true;
    return false;
  }

  canManageStatus(reservation: Reservation): boolean {
    return this.userRole === Rol.ADMIN && reservation.status === ReservationStatus.PENDIENTE;
  }

  canCancelReservation(reservation: Reservation): boolean {
    if (this.userRole === Rol.ADMIN) return true;
    if (this.currentUser && reservation.userId === this.currentUser.id && 
        reservation.status !== ReservationStatus.CANCELADA && 
        reservation.status !== ReservationStatus.RECHAZADA) {
        return true;
    }
    return false;
  }

  navigateToAddReservation() {
    this.navCtrl.navigateForward('/app/reservations/new');
  }

  navigateToEditReservation(reservationId?: string) {
    if (!reservationId) return;
    this.navCtrl.navigateForward(`/app/reservations/edit/${reservationId}`);
  }

  async confirmAction(reservation: Reservation, newStatus: ReservationStatus, listType: 'main' | 'pending') {
    if (!reservation.id) return;
    let actionText = '';
    let headerText = '';
    if (newStatus === ReservationStatus.CANCELADA) {
        actionText = 'cancelar';
        headerText = 'Confirmar Cancelación';
    } else if (newStatus === ReservationStatus.CONFIRMADA && this.userRole === Rol.ADMIN) {
        actionText = 'confirmar';
        headerText = 'Confirmar Reserva';
    } else if (newStatus === ReservationStatus.RECHAZADA && this.userRole === Rol.ADMIN) {
        actionText = 'rechazar';
        headerText = 'Rechazar Reserva';
    } else { return; }

    const alert = await this.alertCtrl.create({
      header: headerText,
      message: `¿Estás seguro de ${actionText} la reserva para "${reservation.classroom?.name || reservation.classroomId}" el ${this.datePipe.transform(reservation.startTime, 'dd/MM/yy HH:mm')}?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Sí',
          cssClass: newStatus === ReservationStatus.CANCELADA || newStatus === ReservationStatus.RECHAZADA ? 'text-kwd-red' : 'text-kwd-green',
          handler: () => this.updateStatus(reservation.id!, newStatus, listType),
        },
      ],
    });
    await alert.present();
  }

  private async updateStatus(id: string, status: ReservationStatus, listType: 'main' | 'pending') {
    const loading = await this.loadingCtrl.create({ message: 'Actualizando estado...' });
    await loading.present();
    this.reservationService.updateReservationStatus(id, status)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: async () => {
        await this.presentToast('Estado de la reserva actualizado.', 'success');
        if (listType === 'main') {
          this.loadReservations(); 
        } else if (listType === 'pending') {
          this.loadPendingReservations(); 

          this.loadReservations();
        }
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al actualizar estado.', 'danger');
      },
      complete: async () => {
        await loading.dismiss();
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', icon: iconName });
    await toast.present();
  }

  handleRefresh(event: CustomEvent) {
    this.loadReservations(event);
    if (this.showPendingSection) {
      this.loadPendingReservations(); 
    }
  }
}
