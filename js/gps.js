document.addEventListener('DOMContentLoaded', function() {
    // Configuración MQTT
    const gpsTopic = "iotlab/gps/data";
    const macListTopic = "iotlab/nodes/status";
    const mqttBrokerUrl = "wss://broker.emqx.io:8084/mqtt";

    // Objeto para almacenar los dispositivos y sus marcadores
    const devices = {};
    let map;
    let activeDevice = null;
    let connectionEstablished = false;
    
    // Configuración MQTT
    const options = {
        keepalive: 60,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        clientId: 'tracker_' + Math.random().toString(16).substr(2, 8)
    };
    
    const client = mqtt.connect(mqttBrokerUrl, options);
    const connStatus = document.getElementById("connection-status");
    const deviceButtonsContainer = document.getElementById("device-buttons");
    
    // Inicializar mapa
    function initMap() {
        map = L.map('map').setView([10.4806, -66.9036], 10);
    
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19
        }).addTo(map);
        
        L.control.scale({ imperial: false }).addTo(map);
    }

    // Crear o actualizar marcador para un dispositivo
    function updateDeviceMarker(mac, data) {
        const now = new Date();
        
        if (!devices[mac]) {
            // Crear nuevo marcador con icono personalizado
            const icon = L.divIcon({
                className: 'custom-icon',
                html: `<div class="device-marker" style="background-color: ${getColorForMac(mac)}">
                         <i class="fas fa-map-marker-alt"></i>
                       </div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 30]
            });
            
            const marker = L.marker([data.lat, data.lng], {
                title: `Dispositivo: ${mac}`,
                icon: icon,
                riseOnHover: true
            }).addTo(map);
            
            // Crear botón para este dispositivo
            const btn = document.createElement('button');
            btn.className = 'device-btn';
            btn.innerHTML = `<i class="fas fa-map-marker-alt" style="color: ${getColorForMac(mac)}"></i> ${mac.substring(0, 6)}...`;
            btn.dataset.mac = mac;
            btn.onclick = () => focusDevice(mac);
            deviceButtonsContainer.appendChild(btn);
            
            devices[mac] = {
                marker: marker,
                button: btn,
                lastData: data,
                lastUpdate: now
            };
        } else {
            // Actualizar marcador existente
            devices[mac].marker.setLatLng([data.lat, data.lng]);
            devices[mac].lastData = data;
            devices[mac].lastUpdate = now;
        }
        
        // Actualizar popup con la información más reciente
        devices[mac].marker.bindPopup(`
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 5px 0; color: ${getColorForMac(mac)}">Dispositivo: ${mac}</h4>
                <p><b>Última actualización:</b> ${now.toLocaleTimeString()}</p>
                <p><b>Lat:</b> ${data.lat.toFixed(6)}</p>
                <p><b>Lng:</b> ${data.lng.toFixed(6)}</p>
                <p><b>Alt:</b> ${data.alt.toFixed(2)} m</p>
                <p><b>Satélites:</b> ${data.sats}</p>
            </div>
        `);
        
        // Si es el primer dispositivo o el dispositivo activo, enfocarlo
        if (Object.keys(devices).length === 1 || mac === activeDevice) {
            focusDevice(mac);
        }
    }

    // Enfocar un dispositivo específico en el mapa
    function focusDevice(mac) {
        if (devices[mac]) {
            // Actualizar botones
            document.querySelectorAll('.device-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            devices[mac].button.classList.add('active');
            
            // Centrar mapa en este dispositivo
            map.setView(devices[mac].marker.getLatLng(), 15);
            devices[mac].marker.openPopup();
            activeDevice = mac;
        }
    }
    
    // Generar color único para cada MAC
    function getColorForMac(mac) {
        const hash = mac.split('').reduce((acc, char) => {
            return char.charCodeAt(0) + ((acc << 5) - acc);
        }, 0);
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    // Manejo de conexión MQTT
    client.on('connect', () => {
        console.log("Conectado al broker MQTT");
        connStatus.className = "connected";
        connStatus.innerHTML = '<i class="fas fa-plug"></i> Conectado al servidor MQTT';
        connectionEstablished = true;
        
        client.subscribe(gpsTopic, { qos: 1 });
        client.subscribe(macListTopic, { qos: 1 });
    });
    
    client.on('error', (err) => {
        console.error("Error MQTT:", err);
        connStatus.className = "disconnected";
        connStatus.innerHTML = '<i class="fas fa-plug"></i> Error de conexión MQTT';
        connectionEstablished = false;
    });
    
    client.on('reconnect', () => {
        console.log("Intentando reconectar...");
        connStatus.className = "reconnecting";
        connStatus.innerHTML = '<i class="fas fa-plug"></i> Reconectando...';
        connectionEstablished = false;
    });
    
    client.on('message', (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            
            if (topic === macListTopic) {
                // Procesar mensaje de lista de dispositivos
                let macList = [];
                if (Array.isArray(data)) {
                    macList = data;
                } else if (data.devices) {
                    macList = data.devices;
                } else if (data.mac) {
                    macList = [data.mac];
                }
                
                console.log("Dispositivos conectados recibidos:", macList);
                
                Object.keys(devices).forEach(mac => {
                    const isConnected = macList.includes(mac);
                    devices[mac].button.innerHTML = `
                        <i class="fas fa-map-marker-alt" style="color: ${getColorForMac(mac)}"></i> 
                        ${mac.substring(0, 6)}...
                        ${isConnected ? '<i class="fas fa-circle" style="color: green; font-size: 0.6rem; margin-left: 5px;"></i>' : ''}
                    `;
                });
                
            } else if (topic === gpsTopic) {
                // Procesar datos GPS
                const mac = data.mac || data.deviceId;
                const gpsData = {
                    mac: mac,
                    lat: data.lat || data.latitude,
                    lng: data.lng || data.longitude,
                    alt: data.alt || data.altitude || 0,
                    sats: data.sats || data.satellites || 0
                };
                
                if (!mac) {
                    console.error("Mensaje sin identificador MAC");
                    return;
                }
                
                console.log("Datos GPS recibidos de:", mac, gpsData);
                updateDeviceMarker(mac, gpsData);
            }
        } catch (e) {
            console.error("Error al procesar mensaje:", e);
        }
    });

    // Estilo para los marcadores personalizados
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            .custom-icon {
                background: transparent;
                border: none;
            }
            
            .device-marker {
                width: 30px;
                height: 30px;
                border-radius: 50% 50% 50% 0;
                background: #4361ee;
                transform: rotate(-45deg);
                display: flex;
                justify-content: center;
                align-items: center;
                color: white;
                box-shadow: 0 0 5px rgba(0,0,0,0.5);
            }
            
            .device-marker i {
                transform: rotate(45deg);
                font-size: 14px;
                margin-top: 2px;
                margin-right: 2px;
            }
            
            .leaflet-popup-content {
                margin: 10px 15px;
            }
        </style>
    `);

    // Inicializar el mapa
    initMap();
});
