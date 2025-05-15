
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { IonicModule, AlertController, LoadingController, ToastController, NavController, IonRefresher } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.page.html',
  styleUrls: ['./user-list.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class UserListPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  users: User[] = [];
  isLoading = false;
  errorMessage: string = '';
  public RolEnum = Rol; 

  constructor(
    private userService: UserService, 
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {

  }

  ionViewWillEnter() {
    this.loadUsers();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUsers(event?: CustomEvent) {
    this.isLoading = true;
    this.errorMessage = '';
    let loadingOverlay: HTMLIonLoadingElement | undefined;

    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando usuarios...' });
      await loadingOverlay.present();
    }

    this.userService.getAllUsers() 
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: User[]) => {
          this.users = data;
        },
        error: async (err: Error) => {
          this.errorMessage = err.message || 'Error al cargar usuarios.';
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

  navigateToAddUser() {
    this.navCtrl.navigateForward('/app/users/new');
  }

  navigateToEditUser(userId?: string) {
    if (!userId) return;
    this.navCtrl.navigateForward(`/app/users/edit/${userId}`);
  }

  async confirmDelete(user: User) {
    if (!user.id) return;

    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de eliminar al usuario "${user.name || user.email}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'text-kwd-red',
          handler: () => this.deleteUser(user.id!),
        },
      ],
    });
    await alert.present();
  }

  private async deleteUser(id: string) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando usuario...' });
    await loading.present();

    this.userService.deleteUser(id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: async () => {
        await this.presentToast('Usuario eliminado exitosamente.', 'success');
        this.loadUsers();
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al eliminar el usuario.', 'danger');
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
    this.loadUsers(event);
  }
}
