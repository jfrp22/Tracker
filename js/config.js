// js/main.js
// Variables globales
const devices = {};
let currentEditingNode = null;
const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
    clientId: 'webclient_' + Math.random().toString(16).substr(2, 8),
    keepalive: 60,
    clean: true,
    reconnectPeriod: 1000
});

// Elementos del DOM
const statusElement = document.getElementById('connection-status');
const nodesBody = document.getElementById('nodes-body');
const configModal = document.getElementById('config-modal');
const modalTitle = document.getElementById('modal-title');
const nodeRoleSelect = document.getElementById('node-role');
const pairingGroup = document.getElementById('pairing-group');
const pairDeviceSelect = document.getElementById('pair-device');

// Manejo de conexión MQTT
client.on('connect', () => {
    console.log("Conectado al broker MQTT");
    updateConnectionStatus('connected', 'Conectado al servidor MQTT');
    
    // Suscribirse a los topics necesarios
    client.subscribe("iotlab/nodes/status", { qos: 1 });
    client.subscribe("iotlab/pairing/response", { qos: 1 });
    
    // Publicar mensaje de descubrimiento
    client.publish("iotlab/discovery", "DISCOVER_NODES", { qos: 1 });
});

client.on('error', (err) => {
    console.error("Error MQTT:", err);
    updateConnectionStatus('disconnected', 'Error de conexión MQTT');
});

client.on('reconnect', () => {
    console.log("Intentando reconectar...");
    updateConnectionStatus('connecting', 'Reconectando...');
});

client.on('offline', () => {
    console.log("Desconectado del broker MQTT");
    updateConnectionStatus('disconnected', 'Desconectado del servidor MQTT');
});

// Procesar mensajes MQTT
client.on('message', (topic, message) => {
    console.log(`Mensaje recibido [${topic}]:`, message.toString());
    
    try {
        const data = JSON.parse(message.toString());
        
        if (topic === "iotlab/nodes/status") {
            updateDevice(data);
        }
        
        if (topic === "iotlab/pairing/response") {
            if (data.status === "PAIRED") {
                updateDevice({
                    mac: data.slave_mac,
                    paired_with: data.master_mac,
                    status: "active"
                });
                updateDevice({
                    mac: data.master_mac,
                    paired_with: data.slave_mac,
                    status: "active"
                });
                alert(`Emparejamiento exitoso: ${data.slave_mac} → ${data.master_mac}`);
            }
        }
    } catch (e) {
        console.error("Error al procesar mensaje:", e);
    }
});

// Actualizar estado de conexión en la UI
function updateConnectionStatus(status, text) {
    statusElement.className = `status-indicator ${status}`;
    statusElement.innerHTML = `<i class="fas fa-plug"></i> ${text}`;
    
    if (status === 'connected') {
        statusElement.innerHTML += ` <button class="btn btn-sm" onclick="discoverNodes()" style="margin-left: 10px;">
            <i class="fas fa-sync-alt"></i> Buscar nodos
        </button>`;
    }
}

// Actualizar/agregar dispositivo
function updateDevice(data) {
    if (!data.mac) {
        console.warn("Mensaje sin identificador MAC");
        return;
    }
    
    const now = new Date();
    if (!devices[data.mac]) {
        devices[data.mac] = {
            firstSeen: now,
            lastSeen: now,
            role: data.role || 'UNCONFIGURED',
            status: data.status || 'offline',
            paired_with: data.paired_with || '',
            ip: data.ip || 'N/A'
        };
    } else {
        devices[data.mac].lastSeen = now;
        if (data.role) devices[data.mac].role = data.role;
        if (data.status) devices[data.mac].status = data.status;
        if (data.paired_with !== undefined) devices[data.mac].paired_with = data.paired_with;
        if (data.ip) devices[data.mac].ip = data.ip;
    }
    
    updateTable();
}

// Actualizar tabla de nodos
function updateTable() {
    nodesBody.innerHTML = '';
    
    // Marcar como offline si no hay señal en 2 minutos
    const now = new Date();
    Object.keys(devices).forEach(mac => {
        if ((now - new Date(devices[mac].lastSeen)) > 120000) {
            devices[mac].status = 'offline';
        }
    });
    
    // Ordenar dispositivos por estado (online primero) y luego por MAC
    const sortedDevices = Object.entries(devices).sort((a, b) => {
        if (a[1].status === b[1].status) {
            return a[0].localeCompare(b[0]);
        }
        return a[1].status === 'active' ? -1 : 1;
    });
    
    // Generar filas de la tabla
    sortedDevices.forEach(([mac, device]) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${mac}</td>
            <td><span class="badge ${device.role === 'MASTER' ? 'badge-master' : 
                                  device.role === 'SLAVE' ? 'badge-slave' : 'badge-unconfigured'}">
                ${device.role}
            </span></td>
            <td><span class="badge ${device.status === 'active' ? 'badge-online' : 'badge-offline'}">
                ${device.status === 'active' ? 'Online' : 'Offline'}
            </span></td>
            <td>${device.paired_with || 'Ninguno'}</td>
            <td>${device.ip}</td>
            <td>${device.lastSeen.toLocaleTimeString()}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="showConfigModal('${mac}')">
                    <i class="fas fa-cog"></i> Configurar
                </button>
            </td>
        `;
        
        nodesBody.appendChild(row);
    });
}

// Mostrar modal de configuración
function showConfigModal(nodeMac) {
    currentEditingNode = nodeMac;
    const device = devices[nodeMac];
    
    modalTitle.textContent = `Configurar Nodo ${nodeMac}`;
    nodeRoleSelect.value = device.role || 'UNCONFIGURED';
    
    // Actualizar opciones de emparejamiento
    updatePairingOptions();
    
    configModal.classList.add('show');
}

// Ocultar modal
function hideModal() {
    configModal.classList.remove('show');
    currentEditingNode = null;
}

// Actualizar opciones de emparejamiento
function updatePairingOptions() {
    const selectedRole = nodeRoleSelect.value;
    pairDeviceSelect.innerHTML = '';
    pairingGroup.style.display = 'none';
    
    // Solo mostrar opciones de emparejamiento para esclavos
    if (selectedRole === 'SLAVE') {
        pairingGroup.style.display = 'block';
        
        // Obtener maestros disponibles
        const availableMasters = Object.entries(devices)
            .filter(([mac, device]) => 
                device.role === 'MASTER' && 
                device.status === 'active' &&
                mac !== currentEditingNode
            )
            .map(([mac]) => mac);
        
        if (availableMasters.length > 0) {
            availableMasters.forEach(mac => {
                const option = document.createElement('option');
                option.value = mac;
                option.textContent = mac;
                pairDeviceSelect.appendChild(option);
            });
            
            // Seleccionar maestro actual si existe
            if (devices[currentEditingNode]?.paired_with) {
                pairDeviceSelect.value = devices[currentEditingNode].paired_with;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay maestros disponibles';
            option.disabled = true;
            pairDeviceSelect.appendChild(option);
        }
    }
}

// Guardar configuración del nodo
function saveNodeConfig() {
    if (!currentEditingNode) return;
    
    const role = nodeRoleSelect.value;
    const pairWith = role === 'SLAVE' && pairDeviceSelect.value ? pairDeviceSelect.value : '';
    
    const config = {
        target: currentEditingNode,
        role: role
    };
    
    if (pairWith) {
        config.pair_with = pairWith;
    }
    
    console.log("Enviando configuración:", config);
    client.publish('iotlab/nodes/config', JSON.stringify(config), { qos: 1 });
    
    hideModal();
}

// Función para descubrir nodos
function discoverNodes() {
    client.publish('iotlab/discovery', 'DISCOVER_NODES', { qos: 1 });
    alert("Solicitud de descubrimiento enviada");
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    updateTable();
    
    // Verificar nodos offline cada 30 segundos
    setInterval(() => {
        const now = new Date();
        let needUpdate = false;
        
        Object.keys(devices).forEach(mac => {
            if ((now - new Date(devices[mac].lastSeen)) > 120000) {
                if (devices[mac].status !== 'offline') {
                    devices[mac].status = 'offline';
                    needUpdate = true;
                }
            }
        });
        
        if (needUpdate) updateTable();
    }, 30000);
});

// Hacer funciones accesibles globalmente para los eventos onclick en HTML
window.showConfigModal = showConfigModal;
window.hideModal = hideModal;
window.saveNodeConfig = saveNodeConfig;
window.discoverNodes = discoverNodes;
window.updatePairingOptions = updatePairingOptions;
