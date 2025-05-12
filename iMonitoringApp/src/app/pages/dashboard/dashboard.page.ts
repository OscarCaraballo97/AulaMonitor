
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Rol } from '../../models/rol.model'; 
import { User } from '../../models/user.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class DashboardPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  userRole: Rol | null = null;
  currentUser: User | null = null;
  isLoadingRole = true;
  totalBuildings: number | string = '-';
  activeReservations: number | string = '-';
  public RolEnum = Rol;

  constructor(
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    console.log('DashboardPage: Constructor ejecutado');
  }

  ngOnInit() {
    console.log('DashboardPage: ngOnInit ejecutado');
    this.authService.getCurrentUserRole().pipe(
      takeUntil(this.destroy$)
    ).subscribe((role: Rol | null) => {
      console.log('DashboardPage: Suscripción a userRole recibió ->', role);
      this.userRole = role;
      this.isLoadingRole = false;
      this.loadDashboardDataBasedOnRole();
      this.cdr.detectChanges();
    });

    this.authService.getCurrentUser().pipe(
      takeUntil(this.destroy$)
    ).subscribe((user: User | null) => {
      console.log('DashboardPage: Suscripción a currentUser recibió ->', user);
      this.currentUser = user;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboardDataBasedOnRole() {
    if (!this.userRole) {
      console.log('DashboardPage: loadDashboardDataBasedOnRole() - userRole es null.');
      return;
    }
    console.log('DashboardPage: Cargando datos específicos del dashboard para el rol:', this.userRole);

    if (this.userRole === Rol.ADMIN) {
      this.totalBuildings = "7";
      this.activeReservations = "23";
    } else if (this.userRole === Rol.PROFESOR) {
      this.activeReservations = "5";
    }
    this.cdr.detectChanges();
  }
}