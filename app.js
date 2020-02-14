var Client = require('ssh2').Client
let parameters = require('./parameters.json')
const fs = require('fs')
const $ = require('jquery')
let nodemailer = require('nodemailer')
const { ipcRenderer } = require('electron')
const os = require('os')

const table = $('#switch-table tbody')
const dataDOM = parameters.switchList.map(item => (
    `<tr id="${item.match(/\d/gm).join('')}"><th>${item}</th><td colspan="3"><div class="load-7">
            <div class="square-holder">
                <div class="square"></div>
            </div>
        </div></td></tr>`
)).join('')
table.html(dataDOM)
$('#path-info').text('All backup file archived: ' + parameters.path)

function process(data,ip,path_) {
    let array = data.split('\n')
    let switchName
    let switchUsers = []
    let configFileSize
    for (const i in array) {
        if (array.hasOwnProperty(i)) {
            function checker(obj1) {
                if (array[i].indexOf(obj1) !== -1) {
                    return true
                } else {
                    return false
                }
            }
            if (checker('hostname')) {
                let name = array[i].split(' ')
                switchName = name[1].toString()
            } else if (checker('username')) {
                let user = array[i].split(' ')
                switchUsers.push(user[1])
            } else if (checker('Current conf')) {
                let size = array[i].split(' ')
                configFileSize = size[3] + ' ' + size[4]
            }
        }
    }
    fs.writeFileSync(path_+'/'+ switchName.trim() + '.txt', data)
    $(`#${ip.match(/\d/gm).join('')}`).replaceWith(`<tr class="success" style="font-family: Arial, Helvetica, sans-serif;font-size:11px"><th>${ip}</th><td>${switchUsers.join(', ')}</td><td>${switchName}</td><td>${configFileSize}</td></tr>`)
}

switchListIndex = 0
async function getSwitchInfo() {
    var conn = new Client()
    let send = 0
    if (switchListIndex >= parameters.switchList.length) { 
        $('#app-info').text('This report created automatically by Node.js - ByS - Running App on ' + os.hostname().toUpperCase())
        if (send === 0) {
            let transporter = nodemailer.createTransport({
            host: parameters.host,
            port: parameters.port,
            auth: {
                user: parameters.sender,
                pass: parameters.senderpass
            }
        })
        var mailOptions = {
            from: parameters.sender,
            to: parameters.to,
            subject: parameters.subject,
            html: '<html>' + document.getElementsByTagName('html')[0].innerHTML + '</html>'
        }
        await transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
            }
        })
        send++
        }
        setTimeout(() => {
            ipcRenderer.send('close-me')
        }, 5000)
        return 
    }
    const switchIP = parameters.switchList[switchListIndex]
    console.log(switchIP)
    conn.on('ready', function () {
        let firstConnect = 0
        let output = ''
        conn.shell(function (err, stream) {
            if (err) throw err
            stream.on('data', function (data) {
                if (firstConnect == 0) {
                    if (data.indexOf('#') !== -1) {
                        stream.write('terminal length 0\nshow run\nshow vlan\n')
                    } else {
                        stream.write('en\n' + parameters.password + '\nterminal length 0\nshow run\nshow vlan\n')
                    }
                    firstConnect++
                }
                if (data.length > 50 || data.indexOf('end') !== -1 ) {
                    output += data.toString()
                    // console.log(output)
                }
                if (data.indexOf('Primary') !== -1 && data.indexOf('Secondary') !== -1) {
                    stream.close()
                    conn.end()
                }
            }).on('error', function (err) {
                console.log(err)
            }).on('close', function () {
                process(output,switchIP,parameters.path)
                switchListIndex++
                stream.close()
                getSwitchInfo()
            })
        })
    }).on('close', function (err) {
    }).on('error', function (err) {
        console.log(err)
        $(`#${switchIP.match(/\d/gm).join('')}`).replaceWith(`<tr class="fail" style="font-family: Arial, Helvetica, sans-serif; font-size:11px"><th>`+ switchIP +`</th><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`)
        switchListIndex++
        getSwitchInfo()
    }).connect({
        host: switchIP,
        port: 22,
        username: parameters.username,
        password: parameters.password,
        readyTimeout: 5000,
        algorithms: {
            cipher: [
                'aes128-ctr',
                'aes192-ctr',
                'aes256-ctr',
                'aes128-gcm',
                'aes128-gcm@openssh.com',
                'aes256-gcm',
                'aes256-gcm@openssh.com',
                'aes256-cbc',
                'aes192-cbc',
                'aes128-cbc',
                'blowfish-cbc',
                '3des-cbc',
                'arcfour256',
                'arcfour128',
                'cast128-cbc',
                'arcfour'
            ],
            kex: [
                'diffie-hellman-group1-sha1',
                'diffie-hellman-group-exchange-sha1',
                'diffie-hellman-group14-sha1',
                'diffie-hellman-group-exchange-sha256',
                'ecdh-sha2-nistp521',
                'ecdh-sha2-nistp384',
                'ecdh-sha2-nistp256'
            ],
        }

    })
}

getSwitchInfo()
