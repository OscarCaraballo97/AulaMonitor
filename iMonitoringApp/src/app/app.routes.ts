import { Routes } from '@angular/router';
import { authGuardFn } from './guards/auth.guard'; 

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage),
  },
  {
    path: 'app', 
    canActivate: [authGuardFn], 
    loadComponent: () => import('./main-layout/main-layout.page').then(m => m.MainLayoutPage),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'buildings',
        
        loadChildren: () => import('./pages/buildings/buildings.routes').then(m => m.BUILDING_ROUTES),
      },
      {
        path: 'classrooms',
       
        loadChildren: () => import('./pages/classrooms/classrooms.routes').then(m => m.CLASSROOMS_ROUTES),
      },
      {
        path: 'reservations',
       
        loadChildren: () => import('./pages/reservations/reservations.routes').then(m => m.RESERVATION_ROUTES),
      },
      {
        path: 'users',
        
        loadChildren: () => import('./pages/users/users.routes').then(m => m.USER_ROUTES),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage),
      },
      {
        path: '', 
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'test-ionic', 
    loadComponent: () => import('./pages/test-ionic/test-ionic.page').then( m => m.TestIonicPage)
  },
  {
    path: '', 
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**', 
    redirectTo: 'login',
  },
];