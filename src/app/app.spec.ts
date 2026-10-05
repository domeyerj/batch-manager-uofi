import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { SailpointPluginService } from '@core';
import { activateTranslations, provideTranslateTesting } from './testing/i18n.testing';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        provideTranslateTesting(),
        // Stub the plugin service so the component does not build a real SDK or
        // attempt an App Shell handshake during the test. The component only
        // reads the `context` and `status` signals.
        {
          provide: SailpointPluginService,
          useValue: {
            context: signal({
              tenant: { org: 'acme' },
              user: { displayName: 'Test User', email: 'test@acme.com' },
              page: { route: 'https://acme.identitysoon.com/ui/plugin/starter', subPath: '' },
            }),
            status: signal('ready'),
            apiReady: () => false,
            setRoute: () => Promise.resolve(),
          },
        },
      ],
    }).compileComponents();

    activateTranslations();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the plugin title in content header', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.shell-content__header h1')?.textContent).toContain('Batch Manager');
  });

  it('renders the handshake status badge', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.shell-content__meta p-tag')).toBeTruthy();
  });

  it('renders tenant and user context', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const context = compiled.querySelector('.shell-content__context');
    expect(context?.textContent).toContain('acme');
    expect(context?.textContent).toContain('Test User');
  });

  it('renders sidebar navigation links', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const links = compiled.querySelectorAll('.shell-sidenav__link');
    expect(links.length).toBe(4);
    expect(links[0].textContent).toContain('Task Monitor');
    expect(links[1].textContent).toContain('Trigger Aggregations');
    expect(links[2].textContent).toContain('Schedules & Forecast');
    expect(links[3].textContent).toContain('Cluster Health');
  });
});
