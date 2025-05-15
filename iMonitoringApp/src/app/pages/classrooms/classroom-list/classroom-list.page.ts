import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular';
import { CommonModule, DatePipe } from '@angular/common'; 
import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { User } from '../../../models/user.model';
import { BuildingService } from '../../../services/building.service'; 
import { Building } from '../../../models/building.model'; 
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, map, switchMap, catchError, tap } from 'rxjs/operators';

@Component({
  selector: 'app-classroom-list',
  templateUrl: './classroom-list.page.html',
  styleUrls: ['./classroom-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class ClassroomListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  classrooms: Classroom[] = [];
  isLoading = false;
  userRole: Rol | null = null;
  errorMessage: string = '';

  buildingNames: { [key: string]: string } = {};


  constructor(
    private classroomService: ClassroomService,
    private authService: AuthService,
    private buildingService: BuildingService,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe((role: Rol | null) => {
        this.userRole = role;
        this.cdr.detectChanges();
      });
  }

  ionViewWillEnter() {
    this.loadClassrooms();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadClassrooms(event?: CustomEvent) {
    this.isLoading = true;
    this.errorMessage = '';
    let loadingOverlay: HTMLIonLoadingElement | undefined;

    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando aulas...' });
      await loadingOverlay.present();
    }

    this.classroomService.getAllClassrooms()
      .pipe(
        takeUntil(this.destroy$),
        tap(classrooms => { 
          const buildingIds = [...new Set(classrooms.map(c => c.buildingId).filter(id => !!id))];
          if (buildingIds.length > 0) {
            const buildingObservables = buildingIds.map(id =>
              this.buildingService.getBuildingById(id).pipe(
                catchError(err => {
                  console.error(`Error cargando edificio ${id}:`, err);
                  return of({ id: id, name: 'Desconocido', location: '' } as Building); // Fallback
                })
              )
            );
            forkJoin(buildingObservables).subscribe(buildings => {
              buildings.forEach(b => {
                if (b && b.id) this.buildingNames[b.id] = b.name;
              });
              this.classrooms = classrooms;
              this.cdr.detectChanges();
            });
          } else {
            this.classrooms = classrooms;
          }
        }),
        catchError(async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar aulas.';
          await this.presentToast(this.errorMessage, 'danger', 'warning-outline');
          this.isLoading = false; 
          if (loadingOverlay) await loadingOverlay.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
          return of([] as Classroom[]); 
        })
      )
      .subscribe({

        complete: async () => {
          this.isLoading = false;
          if (loadingOverlay) await loadingOverlay.dismiss();
          if (event && event.target) (event.target as unknown as IonRefresher).complete();
          this.cdr.detectChanges();
        }
      });
  }

  getBuildingName(buildingId: string): string {
    return this.buildingNames[buildingId] || buildingId;
  }

  canManageClassrooms(): boolean {

    return this.userRole === Rol.ADMIN || this.userRole === Rol.PROFESOR;
  }

  navigateToAddClassroom() {
    this.navCtrl.navigateForward('/app/classrooms/new');
  }

  navigateToEditClassroom(classroomId?: string) {
    if (!classroomId) return;
    this.navCtrl.navigateForward(`/app/classrooms/edit/${classroomId}`);
  }

  async confirmDelete(classroom: Classroom) {
    if (!classroom.id || !this.canManageClassrooms()) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de eliminar el aula "${classroom.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'text-kwd-red',
          handler: () => this.deleteClassroom(classroom.id!),
        },
      ],
    });
    await alert.present();
  }

  private async deleteClassroom(id: string) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando aula...' });
    await loading.present();

    this.classroomService.deleteClassroom(id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: async () => {
        await this.presentToast('Aula eliminada exitosamente.', 'success', 'checkmark-circle-outline');
        this.loadClassrooms();
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al eliminar el aula.', 'danger', 'warning-outline');
      },
      complete: async () => {
        await loading.dismiss();
      }
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3500,
      color: color,
      position: 'top',
      icon: iconName,
      cssClass: `kwd-toast kwd-toast-${color}`
    });
    await toast.present();
  }

  handleRefresh(event: CustomEvent) {
    this.loadClassrooms(event);
  }
}
