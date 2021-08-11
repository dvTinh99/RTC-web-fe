const express = require('express')
const http = require('http')
const app = express()
const server = http.createServer(app)
const io = require("socket.io")(server, {
    allowRequest: (req, callback) => {
        const isOriginValid = true;//check(req);
        callback(null, isOriginValid);
    }
});
const username = require('username-generator')
const path = require('path')


app.get('/', (req, res) => {
    res.send("server is up and running");
})


connections = {}
messages = {}
timeOnline = {}
var users = {}

io.on('connection' ,socket => {
    console.log("new user login");
    var userid  = "";
    
    socket.on("userInfo" ,(userInfo) => {
        
        userid = userInfo.userID;
        userName = userInfo.userName

        if (!users[userid]) {
                users[userid] = socket.id
        }        
        socket.emit('yourID', userid)
        io.sockets.emit('allUsers', users)
    })
    socket.on('disconnect-call', () => {
        delete users[userid]
    })

    socket.on('disconnect', () => {
		var diffTime = Math.abs(timeOnline[socket.id] - new Date())
		var key
		for (const [k, v] of JSON.parse(JSON.stringify(Object.entries(connections)))) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k

					for(let a = 0; a < connections[key].length; ++a){
						io.to(connections[key][a]).emit("user-left", socket.id)
					}
			
					var index = connections[key].indexOf(socket.id)
					connections[key].splice(index, 1)

					console.log(key, socket.id, Math.ceil(diffTime / 1000))

					if(connections[key].length === 0){
						delete connections[key]
					}
				}
			}
		}
	})

    socket.on('join-call', (path) => {
		if(connections[path] === undefined){
			connections[path] = []
		}
		connections[path].push(socket.id)

		timeOnline[socket.id] = new Date()

		for(let a = 0; a < connections[path].length; ++a){
			io.to(connections[path][a]).emit("user-joined", socket.id, connections[path])
		}

		if(messages[path] !== undefined){
			for(let a = 0; a < messages[path].length; ++a){
				io.to(socket.id).emit("chat-message", messages[path][a]['data'], 
					messages[path][a]['sender'], messages[path][a]['socket-id-sender'])
			}
		}

		console.log(path, connections[path])
	})

    socket.on('signal', (toId, message) => {
		io.to(toId).emit('signal', socket.id, message)
	})
    
    socket.on('chat-message', (data, sender) => {
		data = sanitizeString(data)
		sender = sanitizeString(sender)

		var key
		var ok = false
		for (const [k, v] of Object.entries(connections)) {
			for(let a = 0; a < v.length; ++a){
				if(v[a] === socket.id){
					key = k
					ok = true
				}
			}
		}

		if(ok === true){
			if(messages[key] === undefined){
				messages[key] = []
			}
			messages[key].push({"sender": sender, "data": data, "socket-id-sender": socket.id})
			console.log("message", key, ":", sender, data)

			for(let a = 0; a < connections[key].length; ++a){
				io.to(connections[key][a]).emit("chat-message", data, sender, socket.id)
			}
		}
	})

    socket.on('callUser', (data) => {
        io.to(users[data.userToCall]).emit('hey', { signal: data.signalData, from: data.from })
    })

    socket.on('acceptCall', (data) => {
        io.to(users[data.to]).emit('callAccepted', data.signal)
    })

    socket.on('close', (data) => {
        io.to(users[data.to]).emit('close')
    })

    socket.on('rejected', (data) => {
        io.to(users[data.to]).emit('rejected')
    })
})


const port = process.env.PORT || 86

server.listen(port, ()=>{
    console.log(`Server running on port ${port}`)
})