import { useState } from 'react';
import {
  signUp, signIn, confirmSignUp,
  resendSignUpCode, getCurrentUser,
} from 'aws-amplify/auth';


export default function AuthPage({ onAuthSuccess, addToast }) {
  const [mode, setMode]       = useState('login');   // login | register | verify
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const clearError = () => setError('');

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); clearError();
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      if (isSignedIn) {
        const { getCurrentUser } = await import('aws-amplify/auth');
        const user = await getCurrentUser();
        onAuthSuccess(user);
        addToast('¡Bienvenido de vuelta! 🍅', 'success');
      } else if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        setMode('verify');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setLoading(true); clearError();
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email, name: name || email.split('@')[0] } },
      });
      setMode('verify');
      addToast('Código de verificación enviado a tu email', 'info');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault(); setLoading(true); clearError();
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      addToast('Email verificado. Iniciando sesión...', 'success');
      // Auto sign in after verification
      const { isSignedIn } = await signIn({ username: email, password });
      if (isSignedIn) {
        const { getCurrentUser } = await import('aws-amplify/auth');
        const user = await getCurrentUser();
        onAuthSuccess(user);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  };

  const handleResendCode = async () => {
    try {
      await resendSignUpCode({ username: email });
      addToast('Código reenviado a tu email', 'info');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const getErrorMessage = (err) => {
    const map = {
      'UserNotFoundException':              'No existe una cuenta con ese email.',
      'NotAuthorizedException':             'Email o contraseña incorrectos.',
      'UsernameExistsException':            'Ya existe una cuenta con ese email.',
      'CodeMismatchException':              'Código incorrecto.',
      'ExpiredCodeException':               'El código expiró. Solicitá uno nuevo.',
      'InvalidPasswordException':           'La contraseña no cumple los requisitos mínimos.',
      'UserNotConfirmedException':          'Debés verificar tu email primero.',
      'LimitExceededException':             'Demasiados intentos. Esperá unos minutos.',
    };
    return map[err.name] || err.message || 'Error inesperado. Intentá de nuevo.';
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {mode === 'login' && (
          <>
            <h1 className="auth-title">🍅 Pomodoro</h1>
            <p className="auth-sub">Iniciá sesión para registrar tus sesiones</p>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input id="login-email" type="email" className="form-input" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña</label>
                <input id="login-password" type="password" className="form-input" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button id="login-submit" type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Iniciar sesión'}
              </button>
            </form>
            <div className="auth-switch">
              ¿No tenés cuenta?
              <button id="go-register" onClick={() => { setMode('register'); clearError(); }}>Registrate gratis</button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <h1 className="auth-title">Crear cuenta</h1>
            <p className="auth-sub">Gratis, sin tarjeta de crédito</p>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Nombre (opcional)</label>
                <input id="reg-name" type="text" className="form-input" value={name}
                  onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input id="reg-email" type="email" className="form-input" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
              </div>
              <div className="form-group">
                <label className="form-label">Contraseña <span style={{color:'var(--clr-text-dim)',fontWeight:400}}>(8+ chars, mayúscula y número)</span></label>
                <input id="reg-password" type="password" className="form-input" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button id="reg-submit" type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Crear cuenta'}
              </button>
            </form>
            <div className="auth-switch">
              ¿Ya tenés cuenta?
              <button id="go-login" onClick={() => { setMode('login'); clearError(); }}>Iniciá sesión</button>
            </div>
          </>
        )}

        {mode === 'verify' && (
          <>
            <h1 className="auth-title">Verificar email</h1>
            <p className="auth-sub">Ingresá el código que enviamos a <strong>{email}</strong></p>
            {error && <div className="form-error">{error}</div>}
            <form onSubmit={handleVerify}>
              <div className="form-group">
                <label className="form-label">Código de verificación</label>
                <input id="verify-code" type="text" className="form-input" value={code}
                  onChange={e => setCode(e.target.value)} placeholder="123456"
                  maxLength={6} style={{textAlign:'center',letterSpacing:'0.3em',fontSize:'1.4rem'}}
                  required autoFocus />
              </div>
              <button id="verify-submit" type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
                {loading ? <span className="spinner" /> : 'Verificar'}
              </button>
            </form>
            <div className="auth-switch">
              ¿No recibiste el código?
              <button id="resend-code" onClick={handleResendCode}>Reenviar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
