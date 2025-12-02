const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const serverApp = createServer(app);
const io = new Server(serverApp);

app.use(express.static(join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public','index.html'));
});

// Caminho para o arquivo users.json
const usersFilePath = path.join(__dirname, '../public/users.json');

// Estrutura de dados para salas (em memória)
const rooms = new Map(); // roomId -> { id, name, creator, participants: Set<socketId>, createdAt }

// Função auxiliar para gerar ID único de sala
function generateRoomId() {
  return 'room_' + Math.random().toString(36).substr(2, 9);
}

// Função para ler usuários do arquivo
async function readUsers() {
  try {
    const data = await fs.readFile(usersFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao ler users.json:', error);
    return [];
  }
}

// Função para salvar usuários no arquivo
async function saveUsers(users) {
  try {
    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 4), 'utf8');
    return true;
  } catch (error) {
    console.error('Erro ao salvar users.json:', error);
    return false;
  }
}

// Função para gerar avatar baseado no nome
function generateAvatar(name) {
  const initial = name.charAt(0).toUpperCase();
  return `https://cdn-icons-png.flaticon.com/512/3481/3481427.png`;
}

// Função para registrar nova máquina
async function registerMachine(socketId, ipAddress) {
  const users = await readUsers();
  
  const existingUser = users.find(user => user.socketId === socketId);
  
  if (existingUser) {
    existingUser.lastConnection = new Date().toISOString();
    await saveUsers(users);
    return existingUser;
  }
  
  // Verifica se já existe um usuário com o mesmo IP (mas sem socketId ativo)
  const existingByIP = users.find(user => 
    user.ipAddress === ipAddress && !user.socketId
  );
  
  if (existingByIP) {
    existingByIP.socketId = socketId;
    existingByIP.lastConnection = new Date().toISOString();
    await saveUsers(users);
    return existingByIP;
  }
  
  const maxId = users.length > 0 ? Math.max(...users.map(u => u.id || 0)) : 0;
  const newUser = {
    id: maxId + 1,
    name: `Usuário ${maxId + 1}`,
    avatar: generateAvatar(`U${maxId + 1}`),
    socketId: socketId,
    ipAddress: ipAddress,
    firstConnection: new Date().toISOString(),
    lastConnection: new Date().toISOString()
  };
  
  users.push(newUser);
  await saveUsers(users);
  
  return newUser;
}

// Função para remover usuário quando desconectar
async function removeUserBySocketId(socketId) {
  const users = await readUsers();
  const filteredUsers = users.filter(user => {
    if (!user.socketId) {
      return true; 
    }
    return user.socketId !== socketId; 
  });
  await saveUsers(filteredUsers);
  return filteredUsers;
}

io.on('connection', async (socket) => {
  
  const ipAddress = socket.handshake.address;
  console.log(`User connected: IP = ${ipAddress}, SocketId = ${socket.id}`);
  
  const registeredUser = await registerMachine(socket.id, ipAddress);
  console.log(`Máquina registrada:`, registeredUser);
  
  socket.broadcast.emit('userConnected', registeredUser);
  
  const allUsers = await readUsers();
  socket.emit('usersList', allUsers);
  
  io.emit('atualizacao', socket.id);

  socket.on('hello', (msg) => {
    console.log(msg); 
    msg.dest = msg.orig;
    msg.orig = io.id;
    io.to(msg.dest).emit('hello', msg);
    console.log('Send message: ' + msg.dest)
  });


  socket.on('message', (msg,callback) => {
      
      console.log('Server - message received:', msg.dados);
      try{
        if (msg.dest === 'all'){
          io.emit('message', msg);
        }
        else if (msg.dest && msg.dest.startsWith('room_')) {
          io.to(msg.dest).emit('message', msg);
          console.log('Server - send to room:', msg.dest);
        }
        else {
          if (msg.dest === null)
            io.to(msg.orig).emit('message', msg);
          else
            io.to(msg.dest).emit('message', msg);
          console.log('Server - send:', msg);
        }
        callback({
          status: "ok"
        });

      } catch (e){
          callback({
            status: e.message()
        });
      }
      
  });

  socket.on('createRoom', (data, callback) => {
    const { roomName } = data;
    const roomId = generateRoomId();
    
    rooms.set(roomId, {
      id: roomId,
      name: roomName || `Sala ${roomId}`,
      creator: socket.id,
      participants: new Set([socket.id]),
      createdAt: new Date().toISOString()
    });
    
    socket.join(roomId);
    
    io.emit('roomCreated', {
      id: roomId,
      name: rooms.get(roomId).name,
      creator: socket.id,
      participantCount: 1
    });
    
    callback({ status: 'ok', roomId: roomId, room: rooms.get(roomId) });
    console.log(`Sala criada: ${roomId} por ${socket.id}`);
  });

  socket.on('joinRoom', (data, callback) => {
    const { roomId } = data;
    
    if (!rooms.has(roomId)) {
      callback({ status: 'error', message: 'Sala não encontrada' });
      return;
    }
    
    const room = rooms.get(roomId);
    room.participants.add(socket.id);
    socket.join(roomId);
    
    socket.to(roomId).emit('userJoinedRoom', {
      roomId: roomId,
      socketId: socket.id
    });
    
    socket.emit('roomParticipants', {
      roomId: roomId,
      participants: Array.from(room.participants)
    });
    
    callback({ status: 'ok', room: room });
    console.log(`Usuário ${socket.id} entrou na sala ${roomId}`);
  });

  socket.on('leaveRoom', (data, callback) => {
    const { roomId } = data;
    
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.participants.delete(socket.id);
      socket.leave(roomId);
      
      socket.to(roomId).emit('userLeftRoom', {
        roomId: roomId,
        socketId: socket.id
      });
      
      if (room.participants.size === 0) {
        rooms.delete(roomId);
        io.emit('roomDeleted', { roomId: roomId });
      }
      
      callback({ status: 'ok' });
      console.log(`Usuário ${socket.id} saiu da sala ${roomId}`);
    } else {
      callback({ status: 'error', message: 'Sala não encontrada' });
    }
  });

  socket.on('listRooms', (callback) => {
    const roomsList = Array.from(rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      creator: room.creator,
      participantCount: room.participants.size,
      createdAt: room.createdAt
    }));
    
    callback({ status: 'ok', rooms: roomsList });
  });

  socket.on('private message', (data) => {
    const { toSocketId, message } = data;
    socket.to(toSocketId).emit('private message', { from: socket.id, message });
  });

  socket.on('updateUserProfile', async (data) => {
    const { socketId, name, avatar } = data;
    
    const users = await readUsers();
    const userIndex = users.findIndex(user => user.socketId === socketId);
    
    if (userIndex !== -1) {
      users[userIndex].name = name;
      
      if (avatar) {
        users[userIndex].avatar = avatar;
      }
      
      await saveUsers(users);
      
      io.emit('usersUpdated', users);
      
      console.log(`Perfil atualizado para usuário ${socketId}: ${name}`);
    } else {
      console.log(`Usuário não encontrado para atualização: ${socketId}`);
    }
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: SocketId = ${socket.id}`);
    
    rooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        socket.to(roomId).emit('userLeftRoom', {
          roomId: roomId,
          socketId: socket.id
        });
        
        if (room.participants.size === 0) {
          rooms.delete(roomId);
          io.emit('roomDeleted', { roomId: roomId });
        }
      }
    });
    
    const users = await readUsers();
    const disconnectedUser = users.find(user => user.socketId === socket.id);
    
    await removeUserBySocketId(socket.id);
    
    if (disconnectedUser) {
      socket.broadcast.emit('userDisconnected', disconnectedUser);
      console.log(`Usuário removido da lista: ${disconnectedUser.name}`);
    }
  });

});

serverApp.listen(3000, () => {
  console.log('server running at http://localhost:3000');
});