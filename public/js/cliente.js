"use strict";

class Cliente{
    constructor(serverEnder){
        this.socket = (serverEnder)?io(serverEnder):io();
    }

    getSocketId(){
        return this.socket.id;
    }

    sendMessage(ev,msg,showMessage){
        
        this.socket.emit(ev, msg, (response) => {
            if (response.status === "ok"){
                let now = new Date();
                msg.hours = now.getHours();
                msg.minutes = now.getMinutes();
                
                showMessage(msg,'sent');
            }
        });
    }
    // recebe as mensagem enviados pelo servidor

    receiveMessage(showMessage){
        this.socket.on('message', (msg) => {
            // Não mostra mensagens que o próprio usuário enviou (evita duplicação em salas)
            if (msg.orig === this.socket.id) {
                return; // Ignora mensagens próprias recebidas via broadcast
            }
            
            let now = new Date();
            msg.hours = now.getHours();
            msg.minutes = now.getMinutes();
            //console.log(" recebeu: " + msg.hours + "minutos: " + msg.minutes);
            showMessage(msg,'received');
        });
        
        // os eventos abaixo foram inseridos para debug
        this.socket.on('connect', () => {
            console.log('Connected to server with id = '+ this.socket.id);
        });
       
        this.socket.on('hello', (msg) => {
            console.log(msg.dados);
        });

         this.socket.on('atualizacao', (msg) => {
            if (msg !==this.socket.id)
                console.log(msg);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
        });
    }
}