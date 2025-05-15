
import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingController, ToastController, NavController } from '@ionic/angular/standalone';
import { ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, catchError, finalize } from 'rxjs/operators';

import { CalendarOptions, EventInput, Calendar } from '@fullcalendar/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';

import { ClassroomService } from '../../../services/classroom.service';
import { Classroom } from '../../../models/classroom.model';
import { Reservation } from '../../../models/reservation.model';
import { AuthService } from '../../../services/auth.service'; 
import { Rol } from '../../../models/rol.model';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-classroom-availability',
  templateUrl: './classroom-availability.page.html',
  styleUrls: ['./classroom-availability.page.scss'],  
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    FullCalendarModule
  ],
  providers: [DatePipe]
})
export class ClassroomAvailabilityPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('availabilityCalendar') calendarComponent: any;
  
  calendarApi!: Calendar;
  private destroy$ = new Subject<void>();

  classroomId: string | null = null;
  classroom: Classroom | null = null;
  
  allClassrooms: Classroom[] = [];
  selectedClassroomId: string | null = null;

  isLoading = false;
  
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    initialView: 'timeGridWeek',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    weekends: true,
    editable: false,
    selectable: true,
    selectMirror: true,
    dayMaxEvents: true,
    locale: 'es',
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista'
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '22:00:00',
    allDaySlot: false,
    events: (fetchInfo, successCallback, failureCallback) => {
      if (this.selectedClassroomId) {
        this.loadReservationsForCalendar(
            this.selectedClassroomId,
            fetchInfo.startStr,
            fetchInfo.endStr,
            successCallback,
            failureCallback
        );
      } else {
        successCallback([]);
      }
    },
    
  };

  userRole: Rol | null = null;

  constructor(
    private classroomService: ClassroomService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private navCtrl: NavController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    console.log("ClassroomAvailabilityPage: ngOnInit");
    this.authService.getCurrentUserRole().pipe(takeUntil(this.destroy$)).subscribe(role => this.userRole = role);

    this.loadAllClassroomsForSelector();

    this.classroomId = this.route.snapshot.paramMap.get('classroomId');
    if (this.classroomId) {
      this.selectedClassroomId = this.classroomId;
      this.loadClassroomDetails(this.classroomId);
     
    }
  }
  
  ngAfterViewInit() {

    if (this.calendarComponent) {
        this.calendarApi = this.calendarComponent.getApi();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadAllClassroomsForSelector() {
    if (this.classroomId) return;

    this.isLoading = true;
    this.classroomService.getAllClassrooms().pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.allClassrooms = data;
       
      },
      error: async (err) => {
        await this.presentToast('Error cargando lista de aulas.', 'danger');
      }
    });
  }

  async loadClassroomDetails(id: string) {
    this.isLoading = true;
    this.classroomService.getClassroomById(id).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (data) => {
        this.classroom = data;
    
        if (this.calendarApi) {
            this.calendarApi.refetchEvents();
        } else if (this.calendarComponent) {
            this.calendarApi = this.calendarComponent.getApi();
            this.calendarApi?.refetchEvents();
        }
      },
      error: async (err) => {
        await this.presentToast('Error cargando detalles del aula.', 'danger');
      }
    });
  }

  onClassroomChange() {
    console.log("Aula seleccionada para calendario:", this.selectedClassroomId);
    if (this.selectedClassroomId) {
        this.loadClassroomDetails(this.selectedClassroomId); 
    }
    if (this.calendarApi) {
      this.calendarApi.refetchEvents();
    } else if (this.calendarComponent) {
        this.calendarApi = this.calendarComponent.getApi();
        this.calendarApi?.refetchEvents();
    } else {
        console.warn("Calendar API no está disponible para refetchEvents en onClassroomChange");
    }
  }

  loadReservationsForCalendar(classroomId: string, start: string, end: string, successCallback: (events: EventInput[]) => void, failureCallback: (error: any) => void) {
    console.log(`Cargando reservas para aula ${classroomId} desde ${start} hasta ${end}`);
    this.isLoading = true;
    this.cdr.detectChanges();

    this.classroomService.getClassroomReservations(classroomId, start, end)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (reservations: Reservation[]) => {
          const calendarEvents: EventInput[] = reservations.map(res => ({
            id: res.id,
            title: res.purpose || `Reservado (${res.user?.name || res.user?.email || 'Usuario'})`,
            start: res.startTime,
            end: res.endTime,
            extendedProps: {
              status: res.status,
              userId: res.userId,
            }
          }));
          console.log("Eventos para calendario:", calendarEvents);
          successCallback(calendarEvents);
        },
        error: (err) => {
          console.error("Error cargando reservas para el calendario:", err);
          this.presentToast('Error al cargar las reservas del calendario.', 'danger');
          failureCallback(err);
        }
      });
  }

  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'top' });
    toast.present();
  }
}
