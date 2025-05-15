// src/app/pages/register/register.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonicModule,
  AlertController, LoadingController, NavController, ToastController
} from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model'; // Asegúrate que la ruta sea correcta
import { RegisterRequest } from '../../models/auth.model';

// Validador personalizado para comparar contraseñas
export function passwordMatchValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatchGlobal: true };
    }
    if (confirmPassword?.hasError('passwordMismatch') && password?.value === confirmPassword?.value) {
      const errors = confirmPassword.errors;
      if (errors) {
        delete errors['passwordMismatch'];
        if (Object.keys(errors).length === 0) confirmPassword.setErrors(null);
        else confirmPassword.setErrors(errors);
      }
    }
    return null;
  };
}

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  errorMessage: string = '';
  isLoading: boolean = false;

  // Para el selector de roles
  public rolesForSelect: { key: string, value: Rol }[] = [];
  public RolEnum = Rol; // Para usar los valores del enum en el template

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router, // Aunque no se usa directamente si navCtrl maneja toda la navegación
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    // Poblar rolesForSelect con todos los roles del enum Rol
    this.rolesForSelect = Object.keys(Rol)
      .filter(key => isNaN(Number(key))) // Obtiene solo las claves de string del enum
      .map(key => ({ key: key.replace('_', ' '), value: Rol[key as keyof typeof Rol] })); // Reemplaza guiones bajos para display

    this.registerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      role: [Rol.ESTUDIANTE, [Validators.required]] // Rol por defecto, pero el usuario podrá cambiarlo
    }, { validators: passwordMatchValidator() });
  }

  // Getters para fácil acceso
  get name() { return this.registerForm.get('name'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }
  get role() { return this.registerForm.get('role'); }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      await this.presentToast('Por favor, corrige los errores en el formulario.', 'warning', 'alert-circle-outline');
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Registrando...' });
    await loading.present();


    const registrationData: RegisterRequest = this.registerForm.value;

    console.log('Enviando datos de registro (con rol seleccionado):', registrationData);

    this.authService.register(registrationData).subscribe({
      next: async (response) => {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentSuccessAlert(registrationData.role); 
      },
      error: async (err: Error) => {
        this.isLoading = false;
        await loading.dismiss();
        this.errorMessage = err.message || 'Ocurrió un error durante el registro. Intenta de nuevo.';
        await this.presentToast(this.errorMessage, 'danger', 'close-circle-outline');
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
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top', icon: iconName });
    await toast.present();
  }

  async presentSuccessAlert(registeredRole: Rol) {
    const roleName = (Object.keys(Rol) as Array<keyof typeof Rol>).find(key => Rol[key] === registeredRole) || 'Usuario';
    const alert = await this.alertCtrl.create({
      header: 'Registro Exitoso',
      message: `Tu cuenta de ${roleName.toLowerCase().replace('_', ' ')} ha sido creada. Ahora serás redirigido para iniciar sesión.`,
      buttons: [{
        text: 'OK',
        handler: () => {
          this.navCtrl.navigateRoot('/login', { animated: true, animationDirection: 'back' });
        }
      }],
      backdropDismiss: false
    });
    await alert.present();
  }

  goToLogin() {
    this.navCtrl.navigateBack('/login');
  }
}
