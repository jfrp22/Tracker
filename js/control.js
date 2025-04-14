
document.addEventListener('DOMContentLoaded', function() {
    // Configuración MQTT
    const options = {
        clean: true,
        connectTimeout: 4000,
        clientId: 'web-client-' + Math.random().toString(16).substr(2, 8),
    };
    
    const client = mqtt.connect('wss://test.mosquitto.org:8081/mqtt', options);
    const controlTopic = 'servo/control';
    const statusTopic = 'servo/status';
    const connectTopic = 'servo/connect';
    
    // Elementos UI
    const servo1Slider = document.getElementById('servo1Slider');
    const servo2Slider = document.getElementById('servo2Slider');
    const servo1Input = document.getElementById('servo1Input');
    const servo2Input = document.getElementById('servo2Input');
    const servo1Angle = document.getElementById('servo1Angle');
    const servo2Angle = document.getElementById('servo2Angle');
    const btnCenter1 = document.getElementById('btnCenter1');
    const btnCenter2 = document.getElementById('btnCenter2');
    const connectionStatus = document.getElementById('connectionStatus');
    const servoStatus = document.getElementById('servoStatus');
    const statusText = document.getElementById('statusText');
    
    // Estado
    let isConnected = false;
    
    // Eventos MQTT
    client.on('connect', () => {
        console.log('Conectado al broker MQTT');
        isConnected = true;
        updateConnectionStatus('connected', '<i class="fas fa-plug"></i> Conectado');
        
        // Suscribirse a temas
        client.subscribe(statusTopic, (err) => {
            if (!err) console.log('Suscrito a servo/status');
        });
        
        client.subscribe(connectTopic, (err) => {
            if (!err) console.log('Suscrito a servo/connect');
        });
    });
    
        
        client.on('error', (err) => {
            console.error('Error MQTT:', err);
            updateConnectionStatus('disconnected', '<i class="fas fa-exclamation-triangle"></i> Error de conexión');
        });
        
        client.on('offline', () => {
            isConnected = false;
            updateConnectionStatus('disconnected', '<i class="fas fa-plug"></i> Desconectado');
        });
        
        client.on('message', (topic, message) => {
            const msg = message.toString();
            console.log(`Mensaje recibido [${topic}]: ${msg}`);
            
            try {
                const data = JSON.parse(msg);
                
                if (topic === statusTopic) {
                    // Actualizar ángulos en todos los controles
                    updateAllControls(data.servo1, data.servo2);
                    updateServoStatus('idle', `<i class="fas fa-check-circle"></i> Posición actualizada`);
                }
                
                if (topic === connectTopic) {
                    console.log(`Dispositivo conectado: ${data.ip}`);
                }
            } catch (e) {
                console.error('Error al parsear mensaje JSON:', e);
            }
        });
        
        // Control de sliders
        servo1Slider.addEventListener('input', function() {
            const angle = parseInt(this.value);
            updateInputAndSend(angle, servo2Input.value);
        });
        
        servo2Slider.addEventListener('input', function() {
            const angle = parseInt(this.value);
            updateInputAndSend(servo1Input.value, angle);
        });
        
        // Control de inputs numéricos
        servo1Input.addEventListener('change', function() {
            const angle = parseInt(this.value);
            if (angle >= 0 && angle <= 180) {
                updateSliderAndSend(angle, servo2Input.value);
            } else {
                this.value = servo1Slider.value; // Revertir si es inválido
            }
        });
        
        servo2Input.addEventListener('change', function() {
            const angle = parseInt(this.value);
            if (angle >= 0 && angle <= 180) {
                updateSliderAndSend(servo1Input.value, angle);
            } else {
                this.value = servo2Slider.value; // Revertir si es inválido
            }
        });
        
        // Botones centrar
        btnCenter1.addEventListener('click', () => {
            updateAllControls(90, parseInt(servo2Input.value));
            sendCommand(90, parseInt(servo2Input.value));
        });
        
        btnCenter2.addEventListener('click', () => {
            updateAllControls(parseInt(servo1Input.value), 90);
            sendCommand(parseInt(servo1Input.value), 90);
        });
        
        // Funciones de ayuda
        function updateAllControls(angle1, angle2) {
            // Actualizar slider 1
            servo1Slider.value = angle1;
            servo1Input.value = angle1;
            servo1Angle.textContent = angle1 + '°';
            
            // Actualizar slider 2
            servo2Slider.value = angle2;
            servo2Input.value = angle2;
            servo2Angle.textContent = angle2 + '°';
        }
        
        function updateInputAndSend(angle1, angle2) {
            servo1Input.value = angle1;
            servo1Angle.textContent = angle1 + '°';
            sendCommand(angle1, parseInt(angle2));
        }
        
        function updateSliderAndSend(angle1, angle2) {
            servo2Slider.value = angle2;
            servo2Angle.textContent = angle2 + '°';
            sendCommand(parseInt(angle1), angle2);
        }
        
        function sendCommand(angle1, angle2) {
            if (isConnected) {
                const command = {
                    servo1: angle1,
                    servo2: angle2
                };
                client.publish(controlTopic, JSON.stringify(command), { qos: 1 });
                updateServoStatus('moving', `<i class="fas fa-sync-alt fa-spin"></i> Enviando comando...`);
            }
        }
        
        function updateConnectionStatus(status, text) {
            connectionStatus.className = `status ${status}`;
            connectionStatus.innerHTML = text;
        }
        
    
    function updateServoStatus(status, text) {
        servoStatus.style.display = 'flex';
        servoStatus.className = `status ${status}`;
        statusText.innerHTML = text;
        
        if (status === 'idle') {
            setTimeout(() => {
                servoStatus.style.display = 'none';
            }, 3000);
        }
    }
});
