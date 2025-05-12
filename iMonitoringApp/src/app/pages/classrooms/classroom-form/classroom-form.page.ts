import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-classroom-form',
  templateUrl: './classroom-form.page.html',
  styleUrls: ['./classroom-form.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class ClassroomFormPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
