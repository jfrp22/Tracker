// Funciones compartidas entre páginas

/**
 * Verifica la autenticación del usuario
 * @returns {boolean} True si el usuario está autenticado
 */
function checkAuth() {
    const authTimestamp = localStorage.getItem('authTimestamp');
    const isAuthenticated = localStorage.getItem('authenticated') === 'true';
    
    // Verificar si la autenticación es reciente (menos de 8 horas)
    const isRecent = authTimestamp && (Date.now() - parseInt(authTimestamp)) < (8 * 60 * 60 * 1000);
    
    return isAuthenticated && isRecent;
}

/**
 * Cierra la sesión y redirige al login
 */
function logout() {
    localStorage.removeItem('authenticated');
    localStorage.removeItem('authTimestamp');
    window.location.href = "login.html";
}

/**
 * Inicializa la navegación común
 */
function initCommon() {
    // Verificar autenticación en páginas protegidas
    if (!window.location.pathname.includes('login.html') && !checkAuth()) {
        logout();
        return;
    }
    
    // Marcar enlace activo en el nav
    const currentPage = window.location.pathname.split('/').pop() || 'main.html';
    document.querySelectorAll('.nav-primary a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
    
    // Configurar botón de logout si existe
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initCommon);
