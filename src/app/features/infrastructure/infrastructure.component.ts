import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskManagerService } from '@core';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-infrastructure',
  standalone: true,
  imports: [CommonModule, TableModule, TagModule, ButtonModule],
  templateUrl: './infrastructure.component.html',
  styleUrl: './infrastructure.component.scss',
})
export class InfrastructureComponent {
  protected readonly taskManager = inject(TaskManagerService);

  protected async refreshClusters(): Promise<void> {
    await this.taskManager.loadClusters();
  }
}
