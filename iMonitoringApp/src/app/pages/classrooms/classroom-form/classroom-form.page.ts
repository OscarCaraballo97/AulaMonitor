
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { ClassroomType } from '../../../models/classroom-type.enum'; 
import { BuildingService } from '../../../services/building.service';
import { Building } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';

@Component({
  selector: 'app-classroom-form',
  templateUrl: './classroom-form.page.html',
  styleUrls: ['./classroom-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule],
})
export class ClassroomFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  classroomForm!: FormGroup;
  isEditMode = false;
  classroomId: string | null = null;
  pageTitle = 'Nueva Aula';
  isLoading = false;
  userRole: Rol | null = null;
  buildings: Building[] = [];
  

  classroomTypes = Object.keys(ClassroomType).filter(key => isNaN(Number(key)));
 

  constructor(
    private fb: FormBuilder,
    private classroomService: ClassroomService,
    private buildingService: BuildingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.classroomForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      capacity: [null, [Validators.required, Validators.min(1), Validators.pattern('^[0-9]+$')]],
      type: [null, [Validators.required]], 
      resources: [''],
      buildingId: [null, [Validators.required]],
    });

    this.authService.getCurrentUserRole()
      .pipe(takeUntil(this.destroy$))
      .subscribe((role: Rol | null) => {
        this.userRole = role;
       
        this.checkPermissionsAndLoadData();
        this.cdr.detectChanges();
      });

    this.loadBuildingsForSelect();
  }

  checkPermissionsAndLoadData() {
    if (!this.canManage()) {
       
        if (!this.isEditMode && this.router.url.includes('/new')) {
            this.presentToast('Acceso denegado. No tienes permiso para crear aulas.', 'danger', 'lock-closed-outline');
            this.navCtrl.navigateBack('/app/classrooms');
            return;
        }
       
        if (this.isEditMode) {
             this.presentToast('Acceso denegado. No tienes permiso para editar esta aula.', 'danger', 'lock-closed-outline');
             this.navCtrl.navigateBack('/app/classrooms');
             return;
        }
    }

    this.classroomId = this.route.snapshot.paramMap.get('id');
    if (this.classroomId) {
      this.isEditMode = true;
      this.pageTitle = 'Editar Aula';
      if (this.canManage()) { 
        this.loadClassroomData(this.classroomId);
      }
    } else {
      this.pageTitle = 'Nueva Aula';
     
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

  loadBuildingsForSelect() {
    this.buildingService.getAllBuildings()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.buildings = data;
          this.cdr.detectChanges();
        },
        error: (err) => this.presentToast('Error cargando edificios para seleccionar.', 'danger')
      });
  }

  async loadClassroomData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del aula...' });
    await loading.present();
    this.classroomService.getClassroomById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (classroom) => {
          this.classroomForm.patchValue(classroom);
          this.isLoading = false;
          loading.dismiss();
          this.cdr.detectChanges();
        },
        error: async (err) => {
          this.isLoading = false;
          await loading.dismiss();
          await this.presentToast(err.message || 'Error al cargar datos del aula.', 'danger');
          this.navCtrl.navigateBack('/app/classrooms');
        }
      });
  }

  async onSubmit() {
    if (this.classroomForm.invalid) {
      this.markFormGroupTouched(this.classroomForm);
      await this.presentToast('Por favor, completa todos los campos requeridos.', 'warning');
      return;
    }
    if (!this.canManage()) {
      await this.presentToast('Acción no permitida.', 'danger');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando aula...' : 'Creando aula...' });
    await loading.present();

    const classroomData: Classroom = this.classroomForm.value;
    let operation: Observable<Classroom | void>;

    if (this.isEditMode && this.classroomId) {
      operation = this.classroomService.updateClassroom(this.classroomId, classroomData);
    } else {
      operation = this.classroomService.createClassroom(classroomData);
    }

    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        const successMsg = `Aula ${this.isEditMode ? 'actualizada' : 'creada'} correctamente.`;
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast(successMsg, 'success');
        this.navCtrl.navigateBack('/app/classrooms', { animated: true });
      },
      error: async (err) => {
        this.isLoading = false;
        await loading.dismiss();
        await this.presentToast(err.message || 'Error al guardar el aula.', 'danger');
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
    const toast = await this.toastCtrl.create({ message, duration: 3500, color, position: 'top', icon: iconName });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/classrooms', { animated: true });
  }
}
