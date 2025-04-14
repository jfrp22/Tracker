// Manejo del formulario de contacto
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.querySelector('.contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            // Validación adicional antes de enviar
            const name = this.elements['name'].value.trim();
            const email = this.elements['email'].value.trim();
            const message = this.elements['message'].value.trim();
            
            if (!name || !email || !message) {
                e.preventDefault();
                alert('Por favor complete todos los campos');
                return false;
            }
            
            // Aquí podrías agregar más validaciones o enviar los datos via AJAX
        });
    }
});
