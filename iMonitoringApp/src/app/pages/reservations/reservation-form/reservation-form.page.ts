import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-reservation-form',
  templateUrl: './reservation-form.page.html',
  styleUrls: ['./reservation-form.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ReservationFormPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
