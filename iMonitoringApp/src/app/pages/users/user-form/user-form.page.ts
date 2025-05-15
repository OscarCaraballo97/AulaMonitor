
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user.service'; 
import { User } from '../../../models/user.model';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { passwordMatchValidator } from '../../register/register.page';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.page.html',
  styleUrls: ['./user-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class UserFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  userForm!: FormGroup;
  isEditMode = false;
  userId: string | null = null;
  pageTitle = 'Nuevo Usuario';
  isLoading = false;
  

  public rolesForSelect: { key: string, value: Rol }[] = [];

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.rolesForSelect = Object.keys(Rol)
      .filter(key => isNaN(Number(key)))
      .map(key => ({ key: key.replace('_', ' '), value: Rol[key as keyof typeof Rol] }));

    this.userForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      role: [Rol.ESTUDIANTE, [Validators.required]],
     
      password: [''],
      confirmPassword: ['']
    });


    this.userId = this.route.snapshot.paramMap.get('id');
    if (this.userId) {
      this.isEditMode = true;
      this.pageTitle = 'Editar Usuario';
      this.loadUserData(this.userId);
    
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('confirmPassword')?.clearValidators();
    } else {
      this.pageTitle = 'Nuevo Usuario';
     
      this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);
    }
    this.userForm.get('password')?.updateValueAndValidity();
    this.userForm.get('confirmPassword')?.updateValueAndValidity();

    this.userForm.setValidators(passwordMatchValidator());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadUserData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del usuario...' });
    await loading.present();
    this.userService.getUserById(id) 
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
         
          const { password, ...userDataToPatch } = user;
          this.userForm.patchValue(userDataToPatch);
          this.isLoading = false;
          loading.dismiss();
        },
        error: async (err) => {
          this.isLoading = false;
          await loading.dismiss();
          await this.presentToast(err.message || 'Error al cargar datos del usuario.', 'danger');
          this.navCtrl.navigateBack('/app/users');
        }
      });
  }

  async onSubmit() {
    if (this.userForm.invalid) {
      this.markFormGroupTouched(this.userForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando usuario...' : 'Creando usuario...' });
    await loading.present();

    const userData: User = this.userForm.value;

    delete (userData as any).confirmPassword;

    
    if (this.isEditMode && (!userData.password || userData.password.trim() === '')) {
      delete userData.password;
    }


    let operation: Observable<User | void>;

    if (this.isEditMode && this.userId) {
      operation = this.userService.updateUser(this.userId, userData);
    } else {
      operation = this.userService.createUser(userData);
    }

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        const successMsg = `Usuario ${this.isEditMode ? 'actualizado' : 'creado'} correctamente.`;
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast(successMsg, 'success');
        this.navCtrl.navigateBack('/app/users', { animated: true });
      },
      error: async (err) => {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast(err.message || 'Error al guardar el usuario.', 'danger');
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
    this.navCtrl.navigateBack('/app/users', { animated: true });
  }
}
