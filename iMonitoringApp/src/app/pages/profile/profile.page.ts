import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, NavController, ToastController, AlertController } from '@ionic/angular';
import { User } from 'src/app/models/user.model';
import { AuthService } from 'src/app/services/auth.service';
import { Rol } from 'src/app/models/rol.model';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [
    IonicModule, 
    CommonModule, 
    ReactiveFormsModule 
  ] 
})
export class ProfilePage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  currentUser: User | null = null;
  userRole: Rol | null = null;
  isLoading: boolean = false;

  isEditing: boolean = false;
  profileForm!: FormGroup;

  constructor(
    private authService: AuthService,
    private navCtrl: NavController, 
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder,
    private userService: UserService, 
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) { }

  ngOnInit() {
    this.authService.getCurrentUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
        if (this.currentUser) {
          this.initializeForm(); 
        }
        this.cdr.detectChanges();
      });

    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.userRole = role;
        this.cdr.detectChanges();
      });
  }

  initializeForm() {
    this.profileForm = this.fb.group({
      name: [this.currentUser?.name || '', Validators.required],
      email: [this.currentUser?.email || '', [Validators.required, Validators.email]]
    });
  }

  toggleEditMode() {
    this.isEditing = !this.isEditing;
    if (this.isEditing && this.currentUser) {
      this.profileForm.patchValue({
        name: this.currentUser.name,
        email: this.currentUser.email
      });
    } else if (!this.isEditing && this.profileForm && this.currentUser) { 
      this.profileForm.reset({
        name: this.currentUser.name || '',
        email: this.currentUser.email || ''
      });
    }
  }

  async saveProfile() {
    if (!this.currentUser || !this.currentUser.id) { 
      this.presentToast('Error: No se pudo identificar al usuario actual.', 'danger');
      return;
    }
    if (!this.profileForm || this.profileForm.invalid) {
      this.presentToast('Por favor, verifica los campos del formulario.', 'warning');
      Object.values(this.profileForm.controls).forEach(control => { 
        control.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    const formData = this.profileForm.value;
    const updatedUserData: Partial<User> = {
      name: formData.name,
      email: formData.email,
    };

    this.userService.updateUser(this.currentUser.id, updatedUserData) 
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { 
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (updatedUserFromBackend) => { 
          if (updatedUserFromBackend && typeof updatedUserFromBackend === 'object' && updatedUserFromBackend.id) { 
            this.presentToast('Perfil actualizado correctamente.', 'success');
            this.isEditing = false;
            
            const userToUpdateInAuth: Partial<User> = { 
              name: updatedUserFromBackend.name, 
              email: updatedUserFromBackend.email,
              avatarUrl: updatedUserFromBackend.avatarUrl 
            };
            this.authService.updateCurrentUser(userToUpdateInAuth); 
            
            if (this.currentUser) { 
               this.currentUser = { ...this.currentUser, ...updatedUserFromBackend };
            } else {
               this.currentUser = updatedUserFromBackend;
            }
            this.cdr.detectChanges();
          } else {
             console.log('Actualización de perfil no devolvió un objeto User válido o falló la operación.');
          
          }
        },
        error: (err: any) => { 
          console.error('Error updating profile in component:', err);
          const message = err?.message || 'Error al actualizar el perfil.';
          this.presentToast(message, 'danger');
        }
      });
  }

  async changePassword() {
    const alert = await this.alertCtrl.create({
      header: 'Cambiar Contraseña',
      inputs: [
        { name: 'currentPassword', type: 'password', placeholder: 'Contraseña Actual', attributes: {autocomplete: 'current-password'} },
        { name: 'newPassword', type: 'password', placeholder: 'Nueva Contraseña', attributes: {autocomplete: 'new-password'} },
        { name: 'confirmPassword', type: 'password', placeholder: 'Confirmar Nueva Contraseña', attributes: {autocomplete: 'new-password'} },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cambiar',
          handler: (data) => {
            if (!data.currentPassword || !data.newPassword || !data.confirmPassword) {
              this.presentToast('Todos los campos son requeridos.', 'warning');
              return false; 
            }
            if (data.newPassword.length < 6) { 
                this.presentToast('La nueva contraseña debe tener al menos 6 caracteres.', 'warning');
                return false;
            }
            if (data.newPassword !== data.confirmPassword) {
              this.presentToast('Las nuevas contraseñas no coinciden.', 'warning');
              return false; 
            }
            this.processPasswordChange(data.currentPassword, data.newPassword);
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  processPasswordChange(currentPassword: string, newPassword: string) {
    if (!this.currentUser || !this.currentUser.id) { 
        this.presentToast('Error: Usuario no identificado.', 'danger');
        return;
    }
    this.isLoading = true;
    const passwordUpdateData = {
        currentPassword: currentPassword,
        newPassword: newPassword
    };

    this.userService.updateUserPassword(this.currentUser.id, passwordUpdateData)
        .pipe(
            takeUntil(this.destroy$),
            finalize(() => { 
                this.isLoading = false;
                this.cdr.detectChanges();
            })
        )
        .subscribe({
            next: (response) => { 
                this.presentToast('Contraseña actualizada correctamente.', 'success');
                console.log("Respuesta del backend al cambiar contraseña:", response);
            },
            error: (err: any) => { 
                console.error('Error updating password in component:', err);
                const message = err?.message || 'Error al actualizar la contraseña.';
                this.presentToast(message, 'danger');
            }
        });
  }

  handleAvatarError(event: Event) {
    const element = event.target as HTMLImageElement;
    if (element) {
      element.src = 'assets/icon/default-avatar.svg'; 
    }
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      buttons: [ { text: 'OK', role: 'cancel' } ]
    });
    await toast.present();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}