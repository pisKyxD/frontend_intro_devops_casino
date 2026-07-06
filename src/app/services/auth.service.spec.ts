import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let svc: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    svc = TestBed.inject(AuthService);
  });

  it('se crea', () => {
    expect(svc).toBeTruthy();
  });

  it('parte sin sesión iniciada', () => {
    expect(svc.usuario()).toBeNull();
    expect(svc.autenticado()).toBeFalse();
  });

  it('setUsuario expone el usuario', () => {
    svc.setUsuario({ id: 1, username: 'demo', email: 'demo@casino.test', saldo: 1000, rol: 'jugador' } as any);
    expect(svc.usuario()?.username).toBe('demo');
  });

  it('setSaldo actualiza el saldo del usuario', () => {
    svc.setUsuario({ id: 1, username: 'demo', email: 'demo@casino.test', saldo: 1000, rol: 'jugador' } as any);
    svc.setSaldo(2500);
    expect(svc.usuario()?.saldo).toBe(2500);
  });

  it('logout limpia la sesión', () => {
    svc.setUsuario({ id: 1, username: 'demo', email: 'demo@casino.test', saldo: 1000, rol: 'jugador' } as any);
    svc.logout();
    expect(svc.usuario()).toBeNull();
    expect(svc.autenticado()).toBeFalse();
  });
});