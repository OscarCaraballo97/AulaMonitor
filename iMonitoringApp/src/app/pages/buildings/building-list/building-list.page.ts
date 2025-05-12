
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router'; 
import { IonicModule, AlertController, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common'; 
import { BuildingService } from '../../../services/building.service';
import { Building } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';

@Component({
  selector: 'app-building-list',
  templateUrl: './building-list.page.html',
  standalone: true,
  imports: [
    IonicModule,   
    CommonModule, 
    RouterModule    
  ],
})
export class BuildingListPage implements OnInit {
  buildings: Building[] = [];
  isLoading = false;
  userRole: Rol | null = null;
  errorMessage: string = '';

  constructor(
    private buildingService: BuildingService,
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.authService.getCurrentUserRole().subscribe((role: Rol | null) => { 
      this.userRole = role;
      this.cdr.detectChanges();
    });
  }

  ionViewWillEnter() {
    this.loadBuildings();
  }

  async loadBuildings(event?: any) { 
    this.isLoading = true;
    let loadingOverlay: HTMLIonLoadingElement | undefined;
    if (!event) {
      loadingOverlay = await this.loadingCtrl.create({ message: 'Cargando edificios...' });
      await loadingOverlay.present();
    }

    this.buildingService.getAllBuildings().subscribe({
      next: (data: Building[]) => { 
        this.buildings = data;
        this.isLoading = false;
        if (loadingOverlay) loadingOverlay.dismiss();
        if (event) event.target.complete();
        this.cdr.detectChanges();
      },
      error: async (err: Error) => { 
        this.isLoading = false;
        if (loadingOverlay) loadingOverlay.dismiss();
        if (event) event.target.complete();
        await this.presentToast(err.message || 'Error al cargar edificios.', 'danger');
        this.cdr.detectChanges();
      },
    });
  }

  canManageBuildings(): boolean {
    return this.userRole === Rol.ADMIN || this.userRole === Rol.PROFESOR;
  }

  navigateToAddBuilding() {
    this.navCtrl.navigateForward('/app/buildings/new');
  }

  navigateToEditBuilding(buildingId?: string) {
    if (!buildingId) return;
    this.navCtrl.navigateForward(`/app/buildings/edit/${buildingId}`);
  }

  async confirmDelete(building: Building) {
    if (!building.id || !this.canManageBuildings()) return;
    const alert = await this.alertCtrl.create({
      header: 'Confirmar Eliminación',
      message: `¿Estás seguro de eliminar el edificio "${building.name}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel', cssClass: 'text-gray-700 dark:text-gray-300' },
        {
          text: 'Eliminar',
          cssClass: 'text-red-600 dark:text-kwd-color-red',
          handler: () => this.deleteBuilding(building.id!),
        },
      ],
      cssClass: 'kwd-alert dark:kwd-alert-dark',
    });
    await alert.present();
  }

  private async deleteBuilding(id: string) {
    const loading = await this.loadingCtrl.create({ message: 'Eliminando...' });
    await loading.present();
    this.buildingService.deleteBuilding(id).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.presentToast('Edificio eliminado exitosamente.', 'success', 'checkmark-circle-outline');
        this.loadBuildings();
      },
      error: async (err: Error) => { 
        await loading.dismiss();
        await this.presentToast(err.message || 'Error al eliminar edificio.', 'danger', 'warning-outline');
      },
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning', iconName?: string) {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top',
      icon: iconName,
      cssClass: `kwd-toast kwd-toast-${color}`
    });
    await toast.present();
  }

  handleRefresh(event: any) {
    this.loadBuildings(event);
  }
}