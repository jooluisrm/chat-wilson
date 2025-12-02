// Array de usuários
var usersArray = null;

let currentUser = 1;
let selectedUsers = new Set();
   
var userName = "Anônimo";
var clienteInstance = null; // Referência global ao Cliente
var currentRoomId = null; // Sala atual (null = chat individual)
var roomsList = []; // Lista de salas disponíveis
var chatMode = 'individual'; // 'individual' ou 'room'
    
// Função para atualizar o nome do usuário logado
function updateLoggedUser() {
    if (!clienteInstance || !usersArray) {
        return;
    }
    
    const socketId = clienteInstance.getSocketId();
    if (!socketId) {
        setTimeout(updateLoggedUser, 500);
        return;
    }
    
    // Busca o usuário pelo socketId
    const loggedUser = usersArray.find(user => user.socketId === socketId);
    
    if (loggedUser) {
        // Atualiza a variável userName
        userName = loggedUser.name;
        
        // Atualiza o HTML com o nome e avatar
        const chatTitle = document.querySelector('.chat-user-details h3');
        const chatAvatar = document.querySelector('.chat-avatar img');
        
        if (chatTitle) {
            chatTitle.textContent = loggedUser.name;
        }
        
        if (chatAvatar && loggedUser.avatar) {
            chatAvatar.src = loggedUser.avatar;
            chatAvatar.alt = loggedUser.name;
        }
        
        console.log('Usuário logado atualizado:', loggedUser.name);
    } else {
        console.log('Usuário logado não encontrado ainda...');
    }
}

// Função para configurar listener de atualizações de usuários
function setupUsersUpdateListener(socket) {
    if (socket) {
        socket.on('usersList', function(users) {
            console.log('Lista completa de usuários recebida:', users);
            usersArray = users;
            renderUsersList();
            initializeUserEventListeners();
            updateLoggedUser();
        });
        
        socket.on('userConnected', function(newUser) {
            console.log('Novo usuário conectado:', newUser);
            
            if (usersArray) {
                const exists = usersArray.find(u => u.socketId === newUser.socketId);
                if (!exists) {
                    usersArray.push(newUser);
                    renderUsersList();
                    initializeUserEventListeners();
                }
            }
            
            if (clienteInstance && clienteInstance.getSocketId()) {
                const welcomeMsg = {
                    user: userName,
                    orig: clienteInstance.getSocketId(),
                    dest: newUser.socketId,
                    dados: `Bem-vindo(a), ${newUser.name}!`
                };
                
                setTimeout(() => {
                    clienteInstance.sendMessage('message', welcomeMsg, showMensagem);
                }, 500);
            }
        });
        
        socket.on('userDisconnected', function(disconnectedUser) {
            console.log('Usuário desconectado:', disconnectedUser);
            
            if (usersArray) {
                usersArray = usersArray.filter(u => u.socketId !== disconnectedUser.socketId);
                renderUsersList();
                initializeUserEventListeners();
            }
        });
        
        socket.on('usersUpdated', function(users) {
            console.log('Lista de usuários atualizada pelo servidor:', users);
            usersArray = users;
            renderUsersList();
            initializeUserEventListeners();
            updateLoggedUser();
        });
        
        socket.on('roomCreated', function(roomData) {
            console.log('Nova sala criada:', roomData);
            if ($('#listRoomsModal').is(':visible')) {
                listRooms();
            }
        });
        
        socket.on('roomDeleted', function(data) {
            console.log('Sala deletada:', data);
            if (currentRoomId === data.roomId) {
                currentRoomId = null;
                chatMode = 'individual';
                updateChatHeader(userName);
                updateSelectedUsers();
                $('#leaveRoomBtn').hide();
            }
            if ($('#listRoomsModal').is(':visible')) {
                listRooms();
            }
        });
        
        socket.on('userJoinedRoom', function(data) {
            console.log('Usuário entrou na sala:', data);
        });
        
        socket.on('userLeftRoom', function(data) {
            console.log('Usuário saiu da sala:', data);
        });
    }
}
    
// Inicialização

$(document).ready(()=>{

    $.getJSON("../users.json", function(data) {
            usersArray = data;
           
            })
            .fail(function(jqxhr, textStatus, error) {
                let err = textStatus + ", " + error;
                console.log("Request Failed: " + err);
            });
    
    $('.modal-close, #cancelEditBtn').on('click', function() {
        closeEditModal();
    });
    
    $('#editProfileModal').on('click', function(e) {
        if (e.target === this) {
            closeEditModal();
        }
    });
    
    $('#editProfileForm').on('submit', function(e) {
        e.preventDefault();
        
        const newName = $('#editUserName').val().trim();
        const newAvatar = $('#editUserAvatar').val().trim();
        
        if (!newName) {
            alert('O nome é obrigatório!');
            return;
        }
        
        const socketId = clienteInstance ? clienteInstance.getSocketId() : null;
        if (socketId) {
            clienteInstance.socket.emit('updateUserProfile', {
                socketId: socketId,
                name: newName,
                avatar: newAvatar || null
            });
        } else {
            alert('Erro: Socket não conectado!');
        }
        
        closeEditModal();
    });
    
});

function getUsersAjax(){
$.ajax({
    url: "../users.json",
    dataType: "json",
    success: function(data) {
        usersArray = data;
        console.log(data);
    },
    error: function(jqXHR, textStatus, errorThrown) {
        console.log("Error loading JSON: " + textStatus, errorThrown);
    }
});

}

$(window).on('load', ()=> {
    renderUsersList();
    initializeEventListeners();    
    initializeUserEventListeners();
    
    updateSelectedUsers();
    
    setTimeout(updateLoggedUser, 1500);
});

async function getUsersFetch1() {
    const url = "../users.json"; // arquivo com os usuários
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }

        usersArray = await response.json();
        renderUsersList();
        
    } catch (error) {
        console.error(error.message);
    }
}

function getUsersFetch2() {
    fetch('../users.json') 
        .then(response => response.json()) 
        .then(data => {
            return (data);
        })
        .catch(error => console.error('Error fetching JSON:', error));
}


// Renderizar lista de usuários
function renderUsersList() {
    
    if (!usersArray || usersArray.length === 0) {
        console.log('usersArray está vazio ou null');
        return;
    }
    
    const usersList = $('#usersList');
    usersList.empty(); 
    
    const currentSocketId = clienteInstance ? clienteInstance.getSocketId() : null;
    
    usersArray.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.dataset.user = user.id;
        
        const isCurrentUser = currentSocketId && user.socketId === currentSocketId;
        
        if (isCurrentUser) {
            userItem.innerHTML = `
                <div style="width: 18px; margin-right: 12px;"></div>
                <div class="user-avatar">
                    <img src="${user.avatar}" alt="Avatar">
                </div>
                <div class="user-info">
                    <h3>${user.name} <span class="you-label">(você)</span></h3>
                </div>
            `;
        } else {
            userItem.innerHTML = `
                <input type="checkbox" class="user-checkbox" id="user${user.id}">
                <div class="user-avatar">
                    <img src="${user.avatar}" alt="Avatar">
                </div>
                <div class="user-info">
                    <h3>${user.name}</h3>
                </div>
            `;
        }
               
        $(usersList).append(userItem);
    });
}

// Trocar nome e avatar do usuário
function changeUserName() {
    const socketId = clienteInstance ? clienteInstance.getSocketId() : null;
    if (!socketId || !usersArray) {
        alert('Aguarde a conexão ser estabelecida...');
        return;
    }
    
    const loggedUser = usersArray.find(user => user.socketId === socketId);
    if (!loggedUser) {
        alert('Usuário não encontrado!');
        return;
    }
    
    document.getElementById('editUserName').value = loggedUser.name || '';
    document.getElementById('editUserAvatar').value = loggedUser.avatar || '';
    
    const modal = document.getElementById('editProfileModal');
    modal.style.display = 'flex';
}

// Função para fechar o modal
function closeEditModal() {
    const modal = document.getElementById('editProfileModal');
    modal.style.display = 'none';
}

// Event listeners para usuários
function initializeUserEventListeners() {
    
    document.querySelectorAll('.user-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const userId = parseInt(this.closest('.user-item').dataset.user);
            if (this.checked) {
                selectedUsers.add(userId);
                console.log(`Inseriu ${userId}`);
            } else {
                selectedUsers.delete(userId);
                console.log(`Removeu ${userId}`);
            }
            updateSelectedUsers();
        });
    });
} 
// Event listeners
function initializeEventListeners() {
    const searchInput = document.querySelector('.search-box input');
    searchInput.addEventListener('input', function() {
        filterUsers(this.value);
    });


    $('#changeNameBtn').click(function()
    {
        changeUserName();
    });
    
    $('#createRoomBtn').click(function() {
        $('#createRoomModal').css('display', 'flex');
    });
    
    $('#listRoomsBtn').click(function() {
        listRooms();
        $('#listRoomsModal').css('display', 'flex');
    });
    
    $('#leaveRoomBtn').click(function() {
        leaveRoom();
    });
    
    $('#closeCreateRoomModal, #cancelCreateRoomBtn').click(function() {
        $('#createRoomModal').css('display', 'none');
        $('#roomName').val('');
    });
    
    $('#closeListRoomsModal').click(function() {
        $('#listRoomsModal').css('display', 'none');
    });
    
    $('#createRoomModal, #listRoomsModal').on('click', function(e) {
        if (e.target === this) {
            $(this).css('display', 'none');
        }
    });
    
    $('#createRoomForm').on('submit', function(e) {
        e.preventDefault();
        const roomName = $('#roomName').val().trim();
        if (roomName) {
            createRoom(roomName);
            $('#createRoomModal').css('display', 'none');
            $('#roomName').val('');
        }
    });
    
    clienteInstance = new Cliente(null);
    clienteInstance.receiveMessage(showMensagem);
    
    setupUsersUpdateListener(clienteInstance.socket);
    
    clienteInstance.socket.on('connect', function() {
        console.log('Socket conectado, atualizando usuário logado...');
        setTimeout(updateLoggedUser, 1000);
    });

    $('#form').submit(function(e){
        e.preventDefault();
        let value = $('#messageInput').val().trim();
        
        if (!value) {
            let mensagem = {user: userName, orig:clienteInstance.getSocketId(), dest:'server',dados: "Bom dia"};
            clienteInstance.sendMessage('hello', mensagem);
            return;
        }
        
        if (chatMode === 'room' && currentRoomId) {
            let mensagem = {
                user: userName,
                orig: clienteInstance.getSocketId(),
                dest: currentRoomId, 
                dados: value
            };
            
            clienteInstance.sendMessage('message', mensagem, showMensagem);
            $('#messageInput').val('');
            return;
        }
        
        if (selectedUsers.size === 0) {
            alert('Selecione pelo menos um usuário para enviar a mensagem!');
            return;
        }
        
        const selectedSocketIds = [];
        selectedUsers.forEach(userId => {
            const user = usersArray.find(u => u.id === userId);
            if (user && user.socketId) {
                if (user.socketId !== clienteInstance.getSocketId()) {
                    selectedSocketIds.push(user.socketId);
                }
            }
        });
        
        if (selectedSocketIds.length === 0) {
            alert('Nenhum usuário válido selecionado!');
            return;
        }
        
        selectedSocketIds.forEach(socketId => {
            let mensagem = {
                user: userName,
                orig: clienteInstance.getSocketId(),
                dest: socketId,
                dados: value
            };
            
            clienteInstance.sendMessage('message', mensagem, showMensagem);
        });
        
        $('#messageInput').val('');
        
        console.log(`Mensagem enviada para ${selectedSocketIds.length} destinatário(s)`);
    });
}

// Filtrar usuários
function filterUsers(searchTerm) {
    const userItems = document.querySelectorAll('.user-item');
    
    userItems.forEach(item => {
        const userName = item.querySelector('.user-info h3').textContent.toLowerCase();
        
        if (userName.includes(searchTerm.toLowerCase())) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Atualizar usuários selecionados
function updateSelectedUsers() {
    const count = selectedUsers.size;
    console.log('Usuários selecionados:', Array.from(selectedUsers));
    
    const messageInput = $('#messageInput');
    if (chatMode === 'room' && currentRoomId) {
        const room = roomsList.find(r => r.id === currentRoomId);
        messageInput.attr('placeholder', `Digite uma mensagem para a sala "${room ? room.name : ''}"...`);
    } else if (count > 0) {
        messageInput.attr('placeholder', `Digite uma mensagem... (${count} destinatário${count > 1 ? 's' : ''} selecionado${count > 1 ? 's' : ''})`);
    } else {
        messageInput.attr('placeholder', 'Digite uma mensagem... (selecione destinatários)');
    }
}

// Funções de Sala
// Criar sala
function createRoom(roomName) {
    if (!clienteInstance || !clienteInstance.getSocketId()) {
        alert('Aguarde a conexão ser estabelecida...');
        return;
    }
    
    clienteInstance.socket.emit('createRoom', { roomName: roomName }, (response) => {
        if (response.status === 'ok') {
            currentRoomId = response.roomId;
            chatMode = 'room';
            updateChatHeader(response.room.name);
            updateSelectedUsers();
            $('#leaveRoomBtn').show();
            alert(`Sala "${response.room.name}" criada!`);
        }
    });
}

// Entrar em sala
function joinRoom(roomId) {
    if (!clienteInstance || !clienteInstance.getSocketId()) {
        alert('Aguarde a conexão ser estabelecida...');
        return;
    }
    
    clienteInstance.socket.emit('joinRoom', { roomId: roomId }, (response) => {
        if (response.status === 'ok') {
            currentRoomId = roomId;
            chatMode = 'room';
            updateChatHeader(response.room.name);
            updateSelectedUsers();
            $('#leaveRoomBtn').show();
            alert(`Entrou na sala "${response.room.name}"!`);
        } else {
            alert('Erro ao entrar na sala: ' + response.message);
        }
    });
}

// Sair de sala
function leaveRoom() {
    if (currentRoomId && clienteInstance) {
        clienteInstance.socket.emit('leaveRoom', { roomId: currentRoomId }, (response) => {
            if (response.status === 'ok') {
                currentRoomId = null;
                chatMode = 'individual';
                updateChatHeader(userName);
                updateSelectedUsers();
                $('#leaveRoomBtn').hide();
                alert('Saiu da sala!');
            }
        });
    }
}

// Listar salas
function listRooms() {
    if (!clienteInstance) return;
    
    clienteInstance.socket.emit('listRooms', (response) => {
        if (response.status === 'ok') {
            roomsList = response.rooms;
            renderRoomsList();
        }
    });
}

// Renderizar lista de salas
function renderRoomsList() {
    const container = $('#roomsListContainer');
    container.empty();
    
    if (roomsList.length === 0) {
        container.html('<p style="text-align: center; color: #667781; padding: 20px;">Nenhuma sala disponível. Crie uma nova sala!</p>');
        return;
    }
    
    roomsList.forEach(room => {
        const roomItem = $(`
            <div class="room-item" style="padding: 12px; border-bottom: 1px solid #f0f2f5; cursor: pointer; transition: background-color 0.2s;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="margin: 0; color: #333; font-size: 14px;">${room.name}</h4>
                        <p style="margin: 4px 0 0 0; color: #667781; font-size: 12px;">${room.participantCount} participante${room.participantCount !== 1 ? 's' : ''}</p>
                    </div>
                    <button class="btn-join-room" data-room-id="${room.id}" style="padding: 6px 12px; background: #25d366; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        Entrar
                    </button>
                </div>
            </div>
        `);
        
        roomItem.hover(
            function() { $(this).css('background-color', '#f5f5f5'); },
            function() { $(this).css('background-color', 'transparent'); }
        );
        
        container.append(roomItem);
    });
    
    $('.btn-join-room').on('click', function() {
        const roomId = $(this).data('room-id');
        joinRoom(roomId);
        $('#listRoomsModal').css('display', 'none');
    });
}

// Atualizar header do chat
function updateChatHeader(title) {
    const chatTitle = document.querySelector('.chat-user-details h3');
    if (chatTitle) {
        chatTitle.textContent = title;
    }
    if (chatMode === 'individual') {
        updateLoggedUser();
    }
}

function showMensagem(msg,event){
        
    const item = `<li class="message ${event}"> <div class="message-content">
    <p> ${msg.user}: ${msg.dados} </p><span class="message-time">${msg.hours} :${msg.minutes} </span></div></li>`;
        
    $('#chatMessages').append(item);

}