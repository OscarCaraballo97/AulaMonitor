import { Routes } from '@angular/router';
import { authGuardFn } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
    data: { title: 'Iniciar Sesión' } 
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage),
    data: { title: 'Registro' }
  },
  {
    path: 'app',
    canActivate: [authGuardFn],
    loadComponent: () => import('./main-layout/main-layout.page').then(m => m.MainLayoutPage),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
        data: { title: 'Dashboard' }
      },
      {
        path: 'buildings',
        loadChildren: () => import('./pages/buildings/buildings.routes').then(m => m.BUILDING_ROUTES),
        data: { title: 'Edificios' }
      },
      {
        path: 'classrooms',
        loadChildren: () => import('./pages/classrooms/classrooms.routes').then(m => m.CLASSROOMS_ROUTES),
        data: { title: 'Aulas' } 
      },
      { 
        path: 'reservations',
        loadChildren: () => import('./pages/reservations/reservations.routes').then(m => m.RESERVATION_ROUTES),
        data: { title: 'Reservas' }
      },
      {
        path: 'users',
        loadChildren: () => import('./pages/users/users.routes').then(m => m.USER_ROUTES),
        data: { title: 'Usuarios' }
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
        data: { title: 'Mi Perfil' } 
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }, 
];