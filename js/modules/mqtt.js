// Conexión MQTT compartida
const MQTT_CONFIG = {
    brokerUrl: "wss://test.mosquitto.org:8081/mqtt",
    options: {
        keepalive: 60,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30000
    }
};

class MQTTClient {
    constructor() {
        this.client = null;
        this.topics = {};
        this.connected = false;
    }
    
    connect(clientId) {
        return new Promise((resolve, reject) => {
            const options = { 
                ...MQTT_CONFIG.options, 
                clientId: clientId || 'webclient_' + Math.random().toString(16).substr(2, 8)
            };
            
            this.client = mqtt.connect(MQTT_CONFIG.brokerUrl, options);
            
            this.client.on('connect', () => {
                this.connected = true;
                console.log("Conectado al broker MQTT");
                resolve(this.client);
            });
            
            this.client.on('error', (err) => {
                console.error("Error MQTT:", err);
                reject(err);
            });
            
            this.client.on('message', (topic, message) => {
                if (this.topics[topic]) {
                    try {
                        const data = JSON.parse(message.toString());
                        this.topics[topic].forEach(callback => callback(data));
                    } catch (e) {
                        console.error("Error al procesar mensaje:", e);
                    }
                }
            });
        });
    }
    
    subscribe(topic, callback) {
        if (!this.topics[topic]) {
            this.topics[topic] = [];
            this.client.subscribe(topic, { qos: 1 });
        }
        this.topics[topic].push(callback);
    }
    
    publish(topic, message, options = { qos: 1 }) {
        const payload = typeof message === 'object' ? JSON.stringify(message) : message;
        this.client.publish(topic, payload, options);
    }
    
    disconnect() {
        this.client.end();
        this.connected = false;
    }
}

// Instancia única para la aplicación
const mqttClient = new MQTTClient();

export default mqttClient;
