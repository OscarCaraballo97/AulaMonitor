
import { Routes } from '@angular/router';

export const RESERVATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./reservation-list/reservation-list.page').then(m => m.ReservationListPage),
  },
  {
    path: 'new',
    loadComponent: () => import('./reservation-form/reservation-form.page').then(m => m.ReservationFormPage),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./reservation-form/reservation-form.page').then(m => m.ReservationFormPage),
  },
];