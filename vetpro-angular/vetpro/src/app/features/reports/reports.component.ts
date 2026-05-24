import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { CurrencyCopPipe } from '../../shared/pipes/currency-cop.pipe';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js';

// Registrar todos los controladores y módulos de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyCopPipe, BaseChartDirective],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent implements OnInit {
  private reportSvc = inject(ReportService);

  loading = signal(true);
  exporting = signal(false);
  selectedPeriod = signal('30days');

  // KPIs del Dashboard
  kpis = signal<any>({
    revenue: { current: 0, previous: 0, growth: 0 },
    consultations: { current: 0, previous: 0, growth: 0 },
    newPatients: { current: 0, previous: 0, growth: 0 },
    retentionRate: { current: 0, previous: 0, growth: 0 }
  });

  // Lista de Rotación de Inventario
  inventoryRotation = signal<any[]>([]);

  // Opciones de Periodos
  periods = [
    { id: '30days', label: 'Últimos 30 días' },
    { id: 'thisMonth', label: 'Este Mes' },
    { id: 'thisYear', label: 'Este Año' }
  ];

  /* ── DATASETS DE GRÁFICAS (CHART.JS DATA) ───────────────── */

  // 1. Ingresos Históricos (Línea)
  revenueChartData: ChartData<'line'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Facturación ($ COP)',
      borderColor: '#10b981', // Verde esmeralda
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#059669',
      pointBorderColor: '#ffffff',
      pointHoverRadius: 8,
      pointHoverBackgroundColor: '#10b981'
    }]
  };

  // 2. Servicios más Rentables (Dona)
  rentabilityChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#059669', '#10b981', '#34d399', '#0d9488', '#6b7280'],
      hoverOffset: 12,
      borderWidth: 0
    }]
  };

  // 3. Citas por Estado (Barra)
  appointmentChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [{
      data: [],
      label: 'Atenciones',
      backgroundColor: '#0d9488', // Teal
      hoverBackgroundColor: '#0f766e',
      borderRadius: 6
    }]
  };

  // 4. Población por Especie (Tarta)
  speciesChartData: ChartData<'pie'> = {
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#059669', '#38bdf8', '#fbbf24', '#f87171'],
      borderWidth: 0
    }]
  };

  /* ── CONFIGURACIONES DE GRÁFICAS (CHART.JS OPTIONS) ─────── */

  // Línea
  lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(16, 185, 129, 0.2)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#9ca3af',
          font: { size: 10 },
          callback: (value) => `$${Number(value).toLocaleString()}`
        }
      }
    }
  };

  // Dona
  doughnutChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e2e8f0',
          font: { size: 11, weight: 'bold' },
          padding: 16
        }
      }
    }
  };

  // Barra
  barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1e293b',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0'
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#9ca3af', font: { size: 10 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#9ca3af', precision: 0 }
      }
    }
  };

  // Tarta
  pieChartOptions: ChartOptions<'pie'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#e2e8f0',
          font: { size: 11, weight: 'bold' },
          padding: 16
        }
      }
    }
  };

  ngOnInit() {
    this.loadData();
  }

  // Carga de datos del Dashboard (conectado a API)
  loadData() {
    this.loading.set(true);

    this.reportSvc.getDashboardData().subscribe({
      next: (res) => {
        // 1. Asignar KPIs
        this.kpis.set(res.kpis);

        // 2. Asignar Listado de Inventario
        this.inventoryRotation.set(res.inventoryRotation);

        // 3. Vincular datos de Gráfica 1 (Ingresos)
        this.revenueChartData = {
          labels: res.charts.revenueHistory.labels,
          datasets: [{
            ...this.revenueChartData.datasets[0],
            data: res.charts.revenueHistory.data
          }]
        };

        // 4. Vincular datos de Gráfica 2 (Rentabilidad)
        this.rentabilityChartData = {
          labels: res.charts.serviceRentability.labels,
          datasets: [{
            ...this.rentabilityChartData.datasets[0],
            data: res.charts.serviceRentability.data
          }]
        };

        // 5. Vincular datos de Gráfica 3 (Citas)
        this.appointmentChartData = {
          labels: res.charts.appointmentStatus.labels,
          datasets: [{
            ...this.appointmentChartData.datasets[0],
            data: res.charts.appointmentStatus.data
          }]
        };

        // 6. Vincular datos de Gráfica 4 (Especies)
        this.speciesChartData = {
          labels: res.charts.speciesDistribution.labels,
          datasets: [{
            ...this.speciesChartData.datasets[0],
            data: res.charts.speciesDistribution.data
          }]
        };

        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar datos del reporte ejecutivo:', err);
        this.loading.set(false);
      }
    });
  }

  // Cambiar el filtro de periodos de tiempo con simulación reactiva de carga
  changePeriod(periodId: string) {
    if (this.selectedPeriod() === periodId) return;

    this.selectedPeriod.set(periodId);
    this.loading.set(true);

    // Simular recalculo de métricas basándose en el filtro seleccionado
    setTimeout(() => {
      const baseKpis = { ...this.kpis() };
      let multiplier = 1.0;

      if (periodId === 'thisMonth') {
        multiplier = 0.85;
      } else if (periodId === 'thisYear') {
        multiplier = 4.2;
      }

      this.kpis.set({
        revenue: {
          current: Math.round(baseKpis.revenue.current * multiplier),
          previous: Math.round(baseKpis.revenue.previous * multiplier),
          growth: baseKpis.revenue.growth
        },
        consultations: {
          current: Math.round(baseKpis.consultations.current * multiplier),
          previous: Math.round(baseKpis.consultations.previous * multiplier),
          growth: baseKpis.consultations.growth
        },
        newPatients: {
          current: Math.round(baseKpis.newPatients.current * multiplier),
          previous: Math.round(baseKpis.newPatients.previous * multiplier),
          growth: baseKpis.newPatients.growth
        },
        retentionRate: baseKpis.retentionRate
      });

      this.loading.set(false);
    }, 350);
  }

  // Descarga del reporte CSV/Excel
  exportReport() {
    this.exporting.set(true);

    this.reportSvc.downloadExcelReport().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_ejecutivo_${this.selectedPeriod()}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        
        // Limpieza de objetos de descarga
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.exporting.set(false);
      },
      error: (err) => {
        console.error('Error al generar la descarga del reporte CSV:', err);
        this.exporting.set(false);
      }
    });
  }
}
