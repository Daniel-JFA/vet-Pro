import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

export interface UserItem {
  id: string;
  clinicId: string;
  branchId?: string | null;
  branchName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'vet' | 'assistant' | 'receptionist' | 'walker' | 'groomer';
  active: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  auth = inject(AuthService);

  clinic = signal<any>(null);
  isIndependentVet = computed(() => this.clinic()?.businessType === 'independent_vet');

  users = signal<UserItem[]>([]);
  searchFilter = '';
  roleFilter = signal<'all' | 'vet' | 'assistant' | 'receptionist' | 'groomer'>('all');

  showCreateModal = signal(false);
  editingUser = signal<UserItem | null>(null);

  // Estado del modal de diagnóstico SMTP
  showSmtpModal = signal(false);
  loadingSmtp = signal(false);
  smtpInfo = signal<any>(null);
  testRecipient = '';
  testingSmtp = signal(false);
  testResult = signal('');
  testResultSuccess = signal(false);

  newForm = {
    firstName: '',
    lastName: '',
    email: '',
    role: 'vet',
    branchId: null as string | null,
  };

  vetCount = computed(() => this.users().filter((u) => u.role === 'vet').length);
  assistantCount = computed(() => this.users().filter((u) => u.role === 'assistant').length);
  otherCount = computed(
    () => this.users().filter((u) => u.role !== 'vet' && u.role !== 'assistant').length,
  );

  filteredUsers = computed(() => {
    let list = this.users();
    const query = this.searchFilter.toLowerCase().trim();
    const role = this.roleFilter();

    if (role !== 'all') {
      list = list.filter((u) => u.role === role);
    }

    if (query) {
      list = list.filter(
        (u) =>
          u.firstName.toLowerCase().includes(query) ||
          u.lastName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.role.toLowerCase().includes(query),
      );
    }

    return list;
  });

  ngOnInit() {
    this.loadUsers();
    this.loadClinic();
  }

  loadClinic() {
    this.auth.getClinic().subscribe({
      next: (data) => {
        this.clinic.set(data);
      },
      error: (err) => {
        console.warn('[Users] Error al cargar empresa:', err);
      },
    });
    this.auth.loadBranches().subscribe();
  }

  toggleBusinessType() {
    const nextType = this.isIndependentVet() ? 'clinic' : 'independent_vet';
    const label =
      nextType === 'independent_vet'
        ? 'Veterinario Independiente (Móvil / Domiciliario)'
        : 'Clínica con Sedes Físicas';

    const confirmMsg =
      nextType === 'independent_vet'
        ? '¿Deseas cambiar a modalidad "Veterinario Independiente"? Los usuarios operarán de forma centralizada sin requerir asignación a sedes físicas.'
        : '¿Deseas cambiar a modalidad "Clínica con Sedes"? Podrás organizar tu equipo por sucursales y consultorios físicos.';

    if (!confirm(confirmMsg)) return;

    this.auth.updateClinic({ businessType: nextType }).subscribe({
      next: (res) => {
        this.clinic.set(res.clinic);
        alert(`Modalidad de empresa actualizada a: ${label}`);
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.error || 'No se pudo actualizar la modalidad de la empresa.');
      },
    });
  }

  loadUsers() {
    this.auth.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
      },
      error: (err) => {
        console.warn('[Users] Error al cargar usuarios:', err);
      },
    });
  }

  formatRoleName(role: string): string {
    switch (role) {
      case 'admin':
        return '🛡️ Administrador';
      case 'vet':
        return '🩺 Médico Veterinario';
      case 'assistant':
        return '💉 Auxiliar / Enfermero';
      case 'receptionist':
        return '💼 Recepción / Caja';
      case 'groomer':
        return '✂️ Peluquero / Spa';
      case 'walker':
        return '🐕 Paseador (Walker)';
      default:
        return role;
    }
  }

  openCreateModal() {
    this.newForm = {
      firstName: '',
      lastName: '',
      email: '',
      role: 'vet',
      branchId: this.auth.activeBranchId() || null,
    };
    this.showCreateModal.set(true);
  }

  submitCreateUser() {
    if (!this.newForm.firstName || !this.newForm.lastName || !this.newForm.email) {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    this.auth.createUser(this.newForm).subscribe({
      next: (res) => {
        // El correo falló al enviarse: es la única vez que el enlace se expone,
        // para que el admin pueda entregarlo manualmente al empleado.
        if (!res.emailSent && res.activationLink) {
          alert(
            `${res.message}\n\nEnlace de activación: ${res.activationLink}\n\n` +
              `Compártelo de forma segura con el usuario — expira en 7 días.`,
          );
        } else {
          alert(res.message || 'Usuario creado exitosamente.');
        }
        this.showCreateModal.set(false);
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.error || 'Error al crear usuario.');
      },
    });
  }

  toggleUserStatus(user: UserItem) {
    const newStatus = !user.active;
    this.auth.updateUser(user.id, { active: newStatus }).subscribe({
      next: () => {
        this.users.update((list) =>
          list.map((u) => (u.id === user.id ? { ...u, active: newStatus } : u)),
        );
      },
      error: (err) => {
        alert(err.error?.error || 'No se pudo cambiar el estado del usuario.');
      },
    });
  }

  openEditModal(user: UserItem) {
    this.editingUser.set({ ...user });
  }

  submitEditUser() {
    const user = this.editingUser();
    if (!user) return;

    this.auth
      .updateUser(user.id, {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: user.branchId,
      })
      .subscribe({
        next: () => {
          alert('Usuario actualizado exitosamente.');
          this.editingUser.set(null);
          this.loadUsers();
        },
        error: (err) => alert(err.error?.error || 'Error al actualizar.'),
      });
  }

  openResetPasswordModal(user: UserItem) {
    const newPass = prompt(
      `Ingrese la nueva contraseña para ${user.firstName} ${user.lastName} (mínimo 6 caracteres):`,
    );
    if (!newPass) return;

    if (newPass.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.auth.resetUserPassword(user.id, newPass).subscribe({
      next: (res) => alert(res.message || 'Contraseña actualizada con éxito.'),
      error: (err) => alert(err.error?.error || 'Error al restablecer contraseña.'),
    });
  }

  openSmtpModal() {
    this.showSmtpModal.set(true);
    this.loadingSmtp.set(true);
    this.testResult.set('');
    this.testRecipient = this.auth.currentUser?.email || '';

    this.auth.getSmtpStatus().subscribe({
      next: (res) => {
        this.smtpInfo.set(res);
        this.loadingSmtp.set(false);
      },
      error: (err) => {
        this.smtpInfo.set({
          verified: false,
          message: err.error?.message || 'Error al verificar conexión SMTP',
        });
        this.loadingSmtp.set(false);
      },
    });
  }

  sendTestEmail() {
    if (!this.testRecipient) return;
    this.testingSmtp.set(true);
    this.testResult.set('');

    this.auth.testSmtp(this.testRecipient).subscribe({
      next: (res) => {
        this.testResult.set(res.message || 'Correo de prueba enviado con éxito.');
        this.testResultSuccess.set(true);
        this.testingSmtp.set(false);
      },
      error: (err) => {
        this.testResult.set(
          err.error?.error || 'No se pudo enviar el correo de prueba. Verifica el servidor SMTP.',
        );
        this.testResultSuccess.set(false);
        this.testingSmtp.set(false);
      },
    });
  }
}
