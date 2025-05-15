
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IonicModule, ToastController, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model';
import { User } from '../../models/user.model';
import { BuildingService } from '../../services/building.service';
import { ReservationService } from '../../services/reservation.service';
import { ClassroomService, ClassroomAvailabilitySummary } from '../../services/classroom.service';
import { Reservation, ReservationStatus } from '../../models/reservation.model';
import { Subject, combineLatest, forkJoin, of } from 'rxjs';
import { takeUntil, map, catchError, filter, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
  providers: [DatePipe]
})
export class DashboardPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  userRole: Rol | null = null;
  currentUser: User | null = null;
  isLoadingRole = true;
  isLoadingData = false;

  totalBuildings: number | string = '-';
  classroomAvailability: ClassroomAvailabilitySummary | null = null;
  reservationsToApprove: Reservation[] = [];
  isLoadingReservationsToApprove = false;

  myUpcomingReservations: Reservation[] = [];
  isLoadingMyReservations = false;
  showMyReservationsSection = false;

  public RolEnum = Rol;
  public ReservationStatusEnum = ReservationStatus;

  constructor(
    private authService: AuthService,
    private buildingService: BuildingService,
    private reservationService: ReservationService,
    private classroomService: ClassroomService,
    private cdr: ChangeDetectorRef,
    public datePipe: DatePipe,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController
  ) {
    console.log('>>> DashboardPage: Constructor ejecutado');
  }

  ngOnInit() {
    console.log('>>> DashboardPage: ngOnInit INICIADO');
    this.isLoadingRole = true;
    this.cdr.detectChanges();

    
    combineLatest([
      this.authService.getCurrentUserRole(),
      this.authService.getCurrentUser()
    ]).pipe(
      takeUntil(this.destroy$),
      filter(([role, user]) => role !== null && user !== null) 
    ).subscribe(([role, user]) => {
      console.log('>>> DashboardPage: Rol y Usuario recibidos ->', { role: JSON.stringify(role), user: JSON.stringify(user) });
      this.userRole = role;
      this.currentUser = user; 
      this.isLoadingRole = false;
      this.loadDashboardDataBasedOnRole();
      this.cdr.detectChanges();
    });
    console.log('>>> DashboardPage: ngOnInit COMPLETADO (suscripciones configuradas)');
  }

  ngOnDestroy() {
    console.log('>>> DashboardPage: ngOnDestroy ejecutado');
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardDataBasedOnRole() {
    if (!this.userRole) {
      console.log('>>> DashboardPage: loadDashboardDataBasedOnRole() - userRole es null.');
      this.resetData();
      return;
    }
    console.log('>>> DashboardPage: Cargando datos generales del dashboard para el rol:', this.userRole);
    this.isLoadingData = true;


    if (this.userRole === Rol.ADMIN) {
      this.fetchAdminDashboardData();
    } else if (this.userRole === Rol.PROFESOR) {
      this.fetchProfesorGeneralDashboardData();
    } else if (this.userRole === Rol.TUTOR) {
      this.fetchTutorGeneralDashboardData();
    } else if (this.userRole === Rol.ESTUDIANTE) {
      this.isLoadingData = false;
      console.log(">>> DashboardPage: Lógica general para ESTUDIANTE ejecutada.");
    } else {
      this.isLoadingData = false;
    }
    this.cdr.detectChanges();
  }

  resetData() {

    this.totalBuildings = '-';
    this.classroomAvailability = null;
    this.reservationsToApprove = [];
    this.isLoadingReservationsToApprove = false;
    this.myUpcomingReservations = [];
    this.isLoadingMyReservations = false;
    this.showMyReservationsSection = false;
    this.isLoadingData = false;
    this.cdr.detectChanges();
  }

  fetchAdminDashboardData() {

    console.log(">>> DashboardPage: fetchAdminDashboardData() llamado para ADMIN.");
    this.isLoadingData = true;
    this.isLoadingReservationsToApprove = true;

    forkJoin({
      buildings: this.buildingService.getAllBuildings().pipe(map(b => b.length), catchError(() => { this.totalBuildings = 'Error'; return of('Error'); })),
      availability: this.classroomService.getAvailabilitySummary().pipe(catchError(() => { this.classroomAvailability = null; return of(null); })),
      pending: this.reservationService.getAllReservations({ status: ReservationStatus.PENDIENTE }).pipe(catchError(() => {this.reservationsToApprove = []; return of([])}))
    }).pipe(takeUntil(this.destroy$))
      .subscribe(results => {
        if (results.buildings !== 'Error') this.totalBuildings = results.buildings;
        if (results.availability !== null) this.classroomAvailability = results.availability;
        this.reservationsToApprove = results.pending;
        
        this.isLoadingData = false;
        this.isLoadingReservationsToApprove = false;
        this.cdr.detectChanges();
        console.log(">>> DashboardPage: Datos de ADMIN cargados.", results);
      });
  }

  fetchProfesorGeneralDashboardData() {
    this.isLoadingData = true;
    this.classroomService.getAvailabilitySummary().pipe(
      takeUntil(this.destroy$),
      catchError(() => {
        this.classroomAvailability = null;
        this.presentToast("Error al cargar disponibilidad de aulas.", "danger");
        return of(null);
      })
    ).subscribe(availability => {
      this.classroomAvailability = availability;
      this.isLoadingData = false;
      this.cdr.detectChanges();
      console.log(">>> DashboardPage: Datos generales de PROFESOR cargados.", { availability });
    });
  }
  
  fetchTutorGeneralDashboardData() {
    this.fetchProfesorGeneralDashboardData();
  }

  async toggleMyReservationsSection() {
    this.showMyReservationsSection = !this.showMyReservationsSection;
    if (this.showMyReservationsSection) {
      this.loadMyUpcomingReservations();
    }
  }

  async loadMyUpcomingReservations() {

    if (!this.currentUser?.id) {
      console.warn(">>> DashboardPage: No se puede cargar 'Mis Reservas', ID de usuario no disponible en currentUser.");
      await this.presentToast("No se pudo identificar al usuario para cargar sus reservas.", "warning");
      this.showMyReservationsSection = false;
      this.isLoadingMyReservations = false;
      this.cdr.detectChanges();
      return;
    }

    console.log(">>> DashboardPage: loadMyUpcomingReservations() llamado con userId:", this.currentUser.id);
    this.isLoadingMyReservations = true;
    this.cdr.detectChanges();

    this.reservationService.getMyUpcomingReservations(3).pipe(
      takeUntil(this.destroy$),
      catchError((err) => {
        console.error(">>> DashboardPage: Error cargando mis próximas reservas", err);
        this.myUpcomingReservations = [];
        this.presentToast("Error al cargar tus próximas reservas.", "danger");
        return of([]);
      })
    ).subscribe({
      next: (reservations) => {
        console.log(">>> DashboardPage: 'Mis Reservas' recibidas ->", reservations);
        this.myUpcomingReservations = reservations;
      },
      error: () => {
        this.isLoadingMyReservations = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.isLoadingMyReservations = false;
        this.cdr.detectChanges();
      }
    });
  }

  async confirmReservationAction(reservationId: string, newStatus: ReservationStatus.CONFIRMADA | ReservationStatus.RECHAZADA) {
    const actionText = newStatus === ReservationStatus.CONFIRMADA ? 'aprobar' : 'rechazar';
    const alert = await this.alertCtrl.create({
      header: `Confirmar Acción`,
      message: `¿Estás seguro de que quieres ${actionText} esta reserva?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: actionText.charAt(0).toUpperCase() + actionText.slice(1),
          cssClass: newStatus === ReservationStatus.RECHAZADA ? 'text-kwd-red' : 'text-kwd-green',
          handler: () => this.processReservationAction(reservationId, newStatus),
        },
      ],
    });
    await alert.present();
  }

  private async processReservationAction(reservationId: string, newStatus: ReservationStatus.CONFIRMADA | ReservationStatus.RECHAZADA) {
    const loading = await this.loadingCtrl.create({ message: 'Procesando...' });
    await loading.present();

    this.reservationService.updateReservationStatus(reservationId, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          await this.presentToast(`Reserva ${newStatus === ReservationStatus.CONFIRMADA ? 'aprobada' : 'rechazada'} exitosamente.`, 'success');
          this.fetchAdminDashboardData(); 
        },
        error: async (err) => {
          await this.presentToast(err.message || 'Error al procesar la reserva.', 'danger');
        },
        complete: async () => {
          await loading.dismiss();
        }
      });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
  
    const toast = await this.toastCtrl.create({ 
      message: message,
      duration: 3000,
      color: color,
      position: 'top',
      icon: iconName
    });
    await toast.present();
  }
}
