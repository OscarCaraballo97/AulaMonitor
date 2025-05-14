import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { BuildingService } from '../../../services/building.service';
import { Building } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-building-form',
  templateUrl: './building-form.page.html',
  styleUrls: ['./building-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class BuildingFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  buildingForm!: FormGroup;
  isEditMode = false;
  buildingId: string | null = null;
  pageTitle = 'Nuevo Edificio';
  isLoading = false;
  userRole: Rol | null = null;

  constructor(
    private fb: FormBuilder,
    private buildingService: BuildingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.buildingForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      location: ['', [Validators.required, Validators.minLength(5)]],
    });

    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe((role: Rol | null) => {
        this.userRole = role;
        if (!this.canManage() && (this.isEditMode || (this.router && this.router.url.includes('/new')))) {
          this.presentToast('Acceso denegado. No tienes permiso para esta acción.', 'danger', 'lock-closed-outline');
          this.navCtrl.navigateBack('/app/buildings');
        }
      });

    this.buildingId = this.route.snapshot.paramMap.get('id');
    if (this.buildingId) {
      this.isEditMode = true;
      this.pageTitle = 'Editar Edificio';
      if (this.userRole === null) {
      } else if (this.canManage()) {
        this.loadBuildingData(this.buildingId);
      }
    } else {
      this.pageTitle = 'Nuevo Edificio';
      if (this.userRole !== null && !this.canManage()) {
        this.presentToast('Acceso denegado. No tienes permiso para esta acción.', 'danger', 'lock-closed-outline');
        this.navCtrl.navigateBack('/app/buildings');
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  canManage(): boolean {
    if (this.userRole === null) return false;
    return this.userRole === Rol.ADMIN || this.userRole === Rol.PROFESOR;
  }

  async loadBuildingData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del edificio...' });
    await loading.present();

    this.buildingService.getBuildingById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (building: Building) => {
          this.buildingForm.patchValue(building);
          this.isLoading = false;
          loading.dismiss();
        },
        error: async (err: Error) => {
          this.isLoading = false;
          await loading.dismiss();
          await this.presentToast(err.message || 'Error al cargar datos del edificio.', 'danger', 'warning-outline');
          this.navCtrl.navigateBack('/app/buildings');
        }
      });
  }

  async onSubmit() {
    if (this.buildingForm.invalid) {
      this.markFormGroupTouched(this.buildingForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning', 'alert-circle-outline');
      return;
    }
    if (!this.canManage()) {
      await this.presentToast('Acción no permitida.', 'danger', 'lock-closed-outline');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando edificio...' : 'Creando edificio...' });
    await loading.present();

    const buildingData: Building = this.buildingForm.value;
    let operation: Observable<Building | void>;

    if (this.isEditMode && this.buildingId) {
      operation = this.buildingService.updateBuilding(this.buildingId, buildingData);
    } else {
      operation = this.buildingService.createBuilding(buildingData);
    }

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: async (response?: Building | void) => {
        const successMsg = `Edificio ${this.isEditMode ? 'actualizado' : 'creado'} correctamente.`;
        this.isLoading = false; 
        await loading.dismiss(); 
        await this.presentToast(successMsg, 'success', 'checkmark-circle-outline');
        this.navCtrl.navigateBack('/app/buildings', { animated: true });
      },
      error: async (err: Error) => {
        this.isLoading = false; 
        await loading.dismiss(); 
        await this.presentToast(err.message || 'Error al guardar el edificio.', 'danger', 'warning-outline');
      },

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
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3500,
      color: color,
      position: 'top',
      icon: iconName,
    });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/buildings', { animated: true });
  }
}