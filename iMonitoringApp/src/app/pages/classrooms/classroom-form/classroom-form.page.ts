import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, LoadingController, ToastController, NavController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { ClassroomService, ClassroomRequestData } from '../../../services/classroom.service';
import { BuildingService } from '../../../services/building.service';
import { Classroom } from '../../../models/classroom.model';
import { ClassroomType } from '../../../models/classroom-type.enum';
import { Building } from '../../../models/building.model';
import { AuthService } from '../../../services/auth.service';
import { Rol } from '../../../models/rol.model';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, tap } from 'rxjs/operators';

@Component({
  selector: 'app-classroom-form',
  templateUrl: './classroom-form.page.html',
  styleUrls: ['./classroom-form.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule]
})
export class ClassroomFormPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  classroomForm!: FormGroup;
  isEditMode = false;
  classroomId: string | null = null;
  pageTitle = 'Nueva Aula';
  isLoading = false;
  isLoadingInitialData = true;
  buildings: Building[] = [];
  userRole: Rol | null = null;

  public RolEnum = Rol;
  public ClassroomTypeEnum = ClassroomType;

  constructor(
    private fb: FormBuilder,
    private classroomService: ClassroomService,
    private buildingService: BuildingService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.isLoadingInitialData = true;
    this.cdr.detectChanges();

    this.classroomForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      capacity: [null, [Validators.required, Validators.min(1)]],
      type: [ClassroomType.AULA, Validators.required],
      resources: [''],
      buildingId: [null, Validators.required]
    });

    forkJoin({
      role: this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)),
      buildingsData: this.buildingService.getAllBuildings().pipe(
        tap(bldgs => console.log("Edificios recibidos:", bldgs)),
        catchError(err => {
          this.presentToast('Error crítico: No se pudieron cargar los edificios.', 'danger');
          return of([] as Building[]);
        })
      )
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: results => {
        this.userRole = results.role;
        this.buildings = results.buildingsData || [];

        if (this.userRole !== Rol.ADMIN) {
          this.presentToast('Acceso denegado. Solo los administradores pueden gestionar aulas.', 'danger');
          this.navCtrl.navigateBack('/app/dashboard');
          this.isLoadingInitialData = false;
          this.cdr.detectChanges();
          return;
        }

        this.classroomId = this.route.snapshot.paramMap.get('id');
        if (this.classroomId) {
          this.isEditMode = true;
          this.pageTitle = 'Editar Aula';
          this.loadClassroomData(this.classroomId);
        } else {
          this.pageTitle = 'Nueva Aula';
          this.isLoadingInitialData = false;
        }
        this.cdr.detectChanges();
      },
      error: err => {
        this.isLoadingInitialData = false;
        this.presentToast('Error cargando datos iniciales del formulario.', 'danger');
        this.cdr.detectChanges();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadClassroomData(id: string) {
    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Cargando datos del aula...' });
    await loading.present();

    this.classroomService.getClassroomById(id).pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        this.isLoadingInitialData = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (classroom: Classroom) => {
        this.classroomForm.patchValue({
          name: classroom.name,
          capacity: classroom.capacity,
          type: classroom.type,
          resources: classroom.resources,
          buildingId: classroom.building?.id || classroom.buildingId
        });
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al cargar el aula.', 'danger');
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

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: this.isEditMode ? 'Actualizando aula...' : 'Creando aula...' });
    await loading.present();

    const formValue = this.classroomForm.value;
    const classroomData: ClassroomRequestData = {
      name: formValue.name,
      capacity: formValue.capacity,
      type: formValue.type,
      resources: formValue.resources,
      buildingId: formValue.buildingId
    };

    let operation: Observable<Classroom | void>;
    if (this.isEditMode && this.classroomId) {
      operation = this.classroomService.updateClassroom(this.classroomId, classroomData);
    } else {
      operation = this.classroomService.createClassroom(classroomData);
    }

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(async () => {
        this.isLoading = false;
        await loading.dismiss();
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: async () => {
        await this.presentToast(`Aula ${this.isEditMode ? 'actualizada' : 'creada'} correctamente.`, 'success');
        this.navCtrl.navigateBack('/app/classrooms');
      },
      error: async (err: Error) => {
        await this.presentToast(err.message || 'Error al guardar el aula.', 'danger');
      }
    });
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) this.markFormGroupTouched(control);
    });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }

  cancel() {
    this.navCtrl.navigateBack('/app/classrooms');
  }
}
