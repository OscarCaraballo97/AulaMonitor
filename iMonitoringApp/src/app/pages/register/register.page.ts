
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidatorFn } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonicModule,
  AlertController, LoadingController, NavController, ToastController
} from '@ionic/angular';

import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model';
import { RegisterRequest } from '../../models/auth.model';


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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private navCtrl: NavController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      
      role: [Rol.ESTUDIANTE, [Validators.required]] 
    }, { validators: passwordMatchValidator() });
  }

  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }


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

    const formValues = this.registerForm.value;
   
    const registrationData: RegisterRequest = {
      email: formValues.email,
      password: formValues.password,
      role: Rol.ESTUDIANTE 
    };

    console.log('Enviando datos de registro (solo Estudiante):', registrationData);

    this.authService.register(registrationData).subscribe({
      next: async (response) => {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentSuccessAlert();
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

  async presentSuccessAlert() {
    const alert = await this.alertCtrl.create({
      header: 'Registro Exitoso',
      message: 'Tu cuenta de estudiante ha sido creada. Ahora serás redirigido para iniciar sesión.',
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