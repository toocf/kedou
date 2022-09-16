var app;
var config = {
    // 服务器地址
    server: 'ws://kedou.workerman.net:8280',
    // 画布ID
    sltCvsId: 'site',
    // 输入框ID
    sltChatId: 'chat',
    // 用户性别
    sltManId: 'sex1',
    sltLadyId: 'sex0',
    // 用户头像
    sltAvatarId: 'icon',
    // 用户昵称
    sltNickId: 'nick',
    // 用户气泡文字
    chatTxtId: 'bubble',

    // 链接失败
    failTipId: 'fail',
    // 断开链接ID
    offTipId: 'broken',

    // 新用户默认名称前缀
    defName: 'Guest.',
    // 默认头像
    defAvatar: './images/default.png',

    // 弹幕ID
    bulletId: 'room',

    // 定义键值
    esc: 27,
    enter: 13,
    space: 32,
    up: 38,
    down: 40,
    left: 37,
    right: 39,
}

var InitApp = function () {
    if (app != null) {
        return;
    }
    app = new Appx(config.server, document.getElementById(config.sltCvsId));

    window.addEventListener('resize', app.resize, false);

    document.addEventListener('mousemove', app.mousemove, false);
    document.addEventListener('mousedown', app.mousedown, false);
    document.addEventListener('mouseup', app.mouseup, false);

    document.addEventListener('touchstart', app.touchstart, false);
    document.addEventListener('touchend', app.touchend, false);
    document.addEventListener('touchcancel', app.touchend, false);
    document.addEventListener('touchmove', app.touchmove, false);

    document.addEventListener('keydown', app.keydown, false);
    document.addEventListener('keyup', app.keyup, false);

    setInterval(function () {
        app.update();
        app.draw();
    }, 30);
}

var Appx = function (server, aCanvas) {
    var app = this;
    var model,
        canvas,
        context,
        webSocket,
        webSocketService,
        mouse = {x: 0, y: 0, worldx: 0, worldy: 0, tadpole: null},
        keyNav = {x: 0, y: 0},
        messageQuota = 5

    app.update = function () {
        if (messageQuota < 5 && model.userTadpole.age % 50 == 0) {
            messageQuota++;
        }

        // Update usertadpole
        if (keyNav.x != 0 || keyNav.y != 0) {
            model.userTadpole.userUpdate(model.tadpoles, model.userTadpole.x + keyNav.x, model.userTadpole.y + keyNav.y);
        } else {
            var mvp = getMouseWorldPosition();
            mouse.worldx = mvp.x;
            mouse.worldy = mvp.y;
            model.userTadpole.userUpdate(model.tadpoles, mouse.worldx, mouse.worldy);
        }

        if (model.userTadpole.age % 6 == 0 && model.userTadpole.changed > 1 && webSocketService.hasConnection) {
            model.userTadpole.changed = 0;
            webSocketService.sendUpdate(model.userTadpole);
        }

        model.camera.update(model);

        // Update tadpoles
        for (id in model.tadpoles) {
            model.tadpoles[id].update(mouse);
        }

        // Update waterParticles
        for (i in model.waterParticles) {
            model.waterParticles[i].update(model.camera.getOuterBounds(), model.camera.zoom);
        }

        // Update arrows
        for (i in model.arrows) {
            var cameraBounds = model.camera.getBounds();
            var arrow = model.arrows[i];
            arrow.update();
        }
    };
    app.draw = function () {
        model.camera.setupContext();

        // Draw waterParticles
        for (i in model.waterParticles) {
            model.waterParticles[i].draw(context);
        }

        // Draw tadpoles
        for (id in model.tadpoles) {
            model.tadpoles[id].draw(context);
        }

        // Start UI layer (reset transform matrix)
        model.camera.startUILayer();

        // Draw arrows
        for (i in model.arrows) {
            model.arrows[i].draw(context, canvas);
        }
    };

    app.onSocketOpen = function (e) {
        uri = parseUri(document.location)
        if (uri.queryKey.oauth_token) {
            app.authorize(uri.queryKey.oauth_token, uri.queryKey.oauth_verifier)
        }
    };
    app.onSocketClose = function (e) {
        webSocketService.connectionClosed();
    };
    app.onSocketMessage = function (e) {
        try {
            var data = JSON.parse(e.data);
            webSocketService.processMessage(data);
        } catch (e) {
        }
    };

    app.sendMessage = function (msg) {

        if (messageQuota > 0) {
            messageQuota--;
            webSocketService.sendMessage(msg);
        }
    }
    app.authorize = function (token, verifier) {
        webSocketService.authorize(token, verifier);
    }

    app.mousedown = function (e) {
        mouse.clicking = true;

        if (mouse.tadpole && mouse.tadpole.hover && mouse.tadpole.onclick(e)) {
            return;
        }
        if (model.userTadpole && e.which == 1) {
            model.userTadpole.momentum = model.userTadpole.targetMomentum = model.userTadpole.maxMomentum;
        }
    }
    app.mouseup = function (e) {
        if (model.userTadpole && e.which == 1) {
            model.userTadpole.targetMomentum = 0;
        }
    };
    app.mousemove = function (e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    };

    app.keydown = function (e) {
        if (e.keyCode == config.up) {
            keyNav.y = -1;
            model.userTadpole.momentum = model.userTadpole.targetMomentum = model.userTadpole.maxMomentum;
            e.preventDefault();
        } else if (e.keyCode == config.down) {
            keyNav.y = 1;
            model.userTadpole.momentum = model.userTadpole.targetMomentum = model.userTadpole.maxMomentum;
            e.preventDefault();
        } else if (e.keyCode == config.left) {
            keyNav.x = -1;
            model.userTadpole.momentum = model.userTadpole.targetMomentum = model.userTadpole.maxMomentum;
            e.preventDefault();
        } else if (e.keyCode == config.right) {
            keyNav.x = 1;
            model.userTadpole.momentum = model.userTadpole.targetMomentum = model.userTadpole.maxMomentum;
            e.preventDefault();
        }
    };
    app.keyup = function (e) {
        if (e.keyCode == config.up || e.keyCode == config.down) {
            keyNav.y = 0;
            if (keyNav.x == 0 && keyNav.y == 0) {
                model.userTadpole.targetMomentum = 0;
            }
            e.preventDefault();
        } else if (e.keyCode == config.left || e.keyCode == config.right) {
            keyNav.x = 0;
            if (keyNav.x == 0 && keyNav.y == 0) {
                model.userTadpole.targetMomentum = 0;
            }
            e.preventDefault();
        }
    };

    app.touchstart = function (e) {
        e.preventDefault();
        mouse.clicking = true;

        if (model.userTadpole) {
            model.userTadpole.momentum = model.userTadpole.targetMomentum = model.userTadpole.maxMomentum;
        }

        var touch = e.changedTouches.item(0);
        if (touch) {
            mouse.x = touch.clientX;
            mouse.y = touch.clientY;
        }
    }
    app.touchend = function (e) {
        if (model.userTadpole) {
            model.userTadpole.targetMomentum = 0;
        }
    }
    app.touchmove = function (e) {
        e.preventDefault();

        var touch = e.changedTouches.item(0);
        if (touch) {
            mouse.x = touch.clientX;
            mouse.y = touch.clientY;
        }
    }

    app.resize = function (e) {
        resizeCanvas();
    };

    app.setSex = function (sex) {
        model.userTadpole.sex = sex;
        $.cookie('sex', sex, {expires: 14});
    }
    app.setIcon = function (icon) {
        model.userTadpole.icon = icon;
        $.cookie('icon', icon, {expires: 14});
    }

    var getMouseWorldPosition = function () {
        return {
            x: (mouse.x + (model.camera.x * model.camera.zoom - canvas.width / 2)) / model.camera.zoom,
            y: (mouse.y + (model.camera.y * model.camera.zoom - canvas.height / 2)) / model.camera.zoom
        }
    }

    var resizeCanvas = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };

    // Constructor
    (function () {
        canvas = aCanvas;
        context = canvas.getContext('2d');
        resizeCanvas();

        model = new Model();
        model.settings = server;

        model.userTadpole = new Tadpole();
        model.userTadpole.id = -1;
        model.tadpoles[model.userTadpole.id] = model.userTadpole;

        model.waterParticles = [];
        for (var i = 0; i < 150; i++) {
            model.waterParticles.push(new WaterParticle());
        }

        model.camera = new Camera(canvas, context, model.userTadpole.x, model.userTadpole.y);

        model.arrows = {};

        try {
            webSocket = new WebSocket(server);
        } catch (e) {
            $('#' + config.failTipId).fadeIn(300);
            return;
        }
        webSocket.onopen = app.onSocketOpen;
        webSocket.onclose = app.onSocketClose;
        webSocket.onmessage = app.onSocketMessage;

        webSocketService = new WebSocketService(model, webSocket);
    })();
}

var Arrow = function (tadpole, camera) {
    var arrow = this;

    this.x = 0;
    this.y = 0;

    this.tadpole = tadpole;
    this.camera = camera;

    this.angle = 0;
    this.distance = 10;

    this.opacity = 1;

    this.update = function () {
        arrow.angle = Math.atan2(tadpole.y - arrow.camera.y, tadpole.x - arrow.camera.x);
    };

    this.draw = function (context, canvas) {
        var cameraBounds = arrow.camera.getBounds();

        if (arrow.tadpole.x < cameraBounds[0].x ||
            arrow.tadpole.y < cameraBounds[0].y ||
            arrow.tadpole.x > cameraBounds[1].x ||
            arrow.tadpole.y > cameraBounds[1].y) {

            var size = 7;

            var arrowDistance = 100;

            var angle = arrow.angle;
            var w = (canvas.width / 2) - 10;
            var h = (canvas.height / 2) - 10;
            var aa = Math.atan(h / w);
            var ss = Math.cos(angle);
            var cc = Math.sin(angle);

            if ((Math.abs(angle) + aa) % Math.PI / 2 < aa) {
                arrowDistance = w / Math.abs(ss);
            } else {
                arrowDistance = h / Math.abs(cc);
            }

            var x = (canvas.width / 2) + Math.cos(arrow.angle) * arrowDistance;
            var y = (canvas.height / 2) + Math.sin(arrow.angle) * arrowDistance;

            var point = calcPoint(x, y, this.angle, 2, size);
            var side1 = calcPoint(x, y, this.angle, 1.5, size);
            var side2 = calcPoint(x, y, this.angle, 0.5, size);

            // Draw arrow
            context.fillStyle = 'rgba(255,255,255,' + arrow.opacity + ')';
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(side1.x, side1.y);
            context.lineTo(side2.x, side2.y)
            context.closePath();
            context.fill();
        }
    };

    var calcPoint = function (x, y, angle, angleMultiplier, length) {
        return {
            x: x + Math.cos(angle + Math.PI * angleMultiplier) * length,
            y: y + Math.sin(angle + Math.PI * angleMultiplier) * length
        }
    };
}

var Camera = function (aCanvas, aContext, x, y) {
    var camera = this;

    var canvas = aCanvas;
    var context = aContext;

    this.x = x;
    this.y = y;

    this.minZoom = 1.3;
    this.maxZoom = 1.8;
    this.zoom = this.minZoom;

    var backgroundColor = Math.random() * 360;

    this.setupContext = function () {
        var translateX = canvas.width / 2 - camera.x * camera.zoom;
        var translateY = canvas.height / 2 - camera.y * camera.zoom;

        // Reset transform matrix
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = 'hsl(' + backgroundColor + ',50%,10%)';
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.translate(translateX, translateY);
        context.scale(camera.zoom, camera.zoom);
    };

    this.update = function (model) {
        backgroundColor += 0.08;
        backgroundColor = backgroundColor > 360 ? 0 : backgroundColor;

        var targetZoom = (model.camera.maxZoom + (model.camera.minZoom - model.camera.maxZoom) * Math.min(model.userTadpole.momentum, model.userTadpole.maxMomentum) / model.userTadpole.maxMomentum);
        model.camera.zoom += (targetZoom - model.camera.zoom) / 60;

        var delta = {
            x: (model.userTadpole.x - model.camera.x) / 30,
            y: (model.userTadpole.y - model.camera.y) / 30
        }

        if (Math.abs(delta.x) + Math.abs(delta.y) > 0.1) {
            model.camera.x += delta.x;
            model.camera.y += delta.y;

            for (var i = 0, len = model.waterParticles.length; i < len; i++) {
                var wp = model.waterParticles[i];
                wp.x -= (wp.z - 1) * delta.x;
                wp.y -= (wp.z - 1) * delta.y;
            }
        }
    };

    // Gets bounds of current zoom level of current position
    this.getBounds = function () {
        return [
            {x: camera.x - canvas.width / 2 / camera.zoom, y: camera.y - canvas.height / 2 / camera.zoom},
            {x: camera.x + canvas.width / 2 / camera.zoom, y: camera.y + canvas.height / 2 / camera.zoom}
        ];
    };

    // Gets bounds of minimum zoom level of current position
    this.getOuterBounds = function () {
        return [
            {x: camera.x - canvas.width / 2 / camera.minZoom, y: camera.y - canvas.height / 2 / camera.minZoom},
            {x: camera.x + canvas.width / 2 / camera.minZoom, y: camera.y + canvas.height / 2 / camera.minZoom}
        ];
    };

    // Gets bounds of maximum zoom level of current position
    this.getInnerBounds = function () {
        return [
            {x: camera.x - canvas.width / 2 / camera.maxZoom, y: camera.y - canvas.height / 2 / camera.maxZoom},
            {x: camera.x + canvas.width / 2 / camera.maxZoom, y: camera.y + canvas.height / 2 / camera.maxZoom}
        ];
    };

    this.startUILayer = function () {
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
}

var Message = function (msg) {
    var message = this;
    this.age = 1;
    this.maxAge = 300;
    this.message = msg;

    this.update = function () {
        this.age++;
    }

    this.draw = function (context, x, y, i) {
        var fontsize = 9;
        context.font = fontsize + "px 'proxima-nova-1','proxima-nova-2', arial, sans-serif";
        context.textBaseline = 'hanging';

        var paddingH = 3;
        var paddingW = 6;

        var messageBox = {
            width: context.measureText(message.message).width + paddingW * 2,
            height: fontsize + paddingH * 2,
            x: x,
            y: (y - i * (fontsize + paddingH * 2 + 1)) - 20
        }

        var fadeDuration = 20;

        var opacity = (message.maxAge - message.age) / fadeDuration;
        opacity = opacity < 1 ? opacity : 1;

        context.fillStyle = 'rgba(255,255,255,' + opacity / 10 + ')';
        drawRoundedRectangle(context, messageBox.x, messageBox.y, messageBox.width, messageBox.height, 10);
        context.fillStyle = 'rgba(255,255,255,' + opacity + ')';
        context.fillText(message.message, messageBox.x + paddingW, messageBox.y + paddingH + 1);
    }

    var drawRoundedRectangle = function (ctx, x, y, w, h, rm) {
        var r = rm / 2;
        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.lineTo(x, y + h - r);
        ctx.quadraticCurveTo(x, y + h, x + r, y + h);
        ctx.lineTo(x + w - r, y + h);
        ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - r);
        ctx.lineTo(x + w, y + r);
        ctx.quadraticCurveTo(x + w, y, x + w - r, y);
        ctx.lineTo(x + r, y);
        ctx.quadraticCurveTo(x, y, x, y + r);
        ctx.closePath();
        ctx.fill();
    }
}

var Model = function () {
    this.tadpoles = {};
    this.userTadpole;
    this.camera;
    this.settings;
}

var Tadpole = function () {
    var tadpole = this;

    this.x = Math.random() * 300 - 150;
    this.y = Math.random() * 300 - 150;
    this.size = 4;

    this.name = '';
    this.age = 0;
    this.sex = -1;
    this.icon = config.defAvatar;
    this.img = {};

    this.hover = false;

    this.momentum = 0;
    this.maxMomentum = 3;
    this.angle = Math.PI * 2;

    this.targetX = 0;
    this.targetY = 0;
    this.targetMomentum = 0;

    this.messages = [];
    this.timeSinceLastActivity = 0;

    this.changed = 0;
    this.timeSinceLastServerUpdate = 0;

    this.update = function (mouse) {
        tadpole.timeSinceLastServerUpdate++;

        tadpole.x += Math.cos(tadpole.angle) * tadpole.momentum;
        tadpole.y += Math.sin(tadpole.angle) * tadpole.momentum;

        if (tadpole.targetX != 0 || tadpole.targetY != 0) {
            tadpole.x += (tadpole.targetX - tadpole.x) / 20;
            tadpole.y += (tadpole.targetY - tadpole.y) / 20;
        }

        // Update messages
        for (var i = tadpole.messages.length - 1; i >= 0; i--) {
            var msg = tadpole.messages[i];
            msg.update();

            if (msg.age == msg.maxAge) {
                tadpole.messages.splice(i, 1);
            }
        }

        // Update tadpole hover/mouse state
        if (Math.sqrt(Math.pow(tadpole.x - mouse.worldx, 2) + Math.pow(tadpole.y - mouse.worldy, 2)) < tadpole.size + 2) {
            tadpole.hover = true;
            mouse.tadpole = tadpole;
        } else {
            if (mouse.tadpole && mouse.tadpole.id == tadpole.id) {
                //mouse.tadpole = null;
            }
            tadpole.hover = false;
        }

        tadpole.tail.update();
    };

    this.onclick = function (e) {
        if (e.which == 2) {
            e.preventDefault();
            return true;
        }
        return false;
    };

    this.userUpdate = function (tadpoles, angleTargetX, angleTargetY) {
        this.age++;

        var prevState = {
            angle: tadpole.angle,
            momentum: tadpole.momentum,
        }

        // Angle to targetx and targety (mouse position)
        var anglediff = ((Math.atan2(angleTargetY - tadpole.y, angleTargetX - tadpole.x)) - tadpole.angle);
        while (anglediff < -Math.PI) {
            anglediff += Math.PI * 2;
        }
        while (anglediff > Math.PI) {
            anglediff -= Math.PI * 2;
        }

        tadpole.angle += anglediff / 5;

        // Momentum to targetmomentum
        if (tadpole.targetMomentum != tadpole.momentum) {
            tadpole.momentum += (tadpole.targetMomentum - tadpole.momentum) / 20;
        }

        if (tadpole.momentum < 0) {
            tadpole.momentum = 0;
        }

        tadpole.changed += Math.abs((prevState.angle - tadpole.angle) * 3) + tadpole.momentum;

        if (tadpole.changed > 1) {
            this.timeSinceLastServerUpdate = 0;
        }
    };

    this.draw = function (context) {
        var opacity = Math.max(Math.min(20 / Math.max(tadpole.timeSinceLastServerUpdate - 300, 1), 1), .2).toFixed(3);

        if (tadpole.hover) {
            drawIcon(context);
        }

        if (tadpole.sex == 0) {
            context.fillStyle = 'rgba(247,121,149,' + opacity + ')';
        } else if (tadpole.sex == 1) {
            context.fillStyle = 'rgba(95,250,234,' + opacity + ')';
        }
        /*else if(mouse.tadpole.id == tadpole.id){
            context.fillStyle = 'rgba(0,191,255,'+opacity+')';
        }*/
        else {
            context.fillStyle = 'rgba(226,219,226,' + opacity + ')';
        }

        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.shadowBlur = 6;
        context.shadowColor = 'rgba(255, 255, 255, ' + opacity * 0.7 + ')';

        // Draw circle
        context.beginPath();
        context.arc(tadpole.x, tadpole.y, tadpole.size, tadpole.angle + Math.PI * 2.7, tadpole.angle + Math.PI * 1.3, true);

        tadpole.tail.draw(context);

        context.closePath();
        context.fill();

        context.shadowBlur = 0;
        context.shadowColor = '';

        drawName(context);
        drawMessages(context);
    };

    var drawName = function (context) {
        var opacity = Math.max(Math.min(20 / Math.max(tadpole.timeSinceLastServerUpdate - 300, 1), 1), .2).toFixed(3);
        context.fillStyle = 'rgba(226,219,226,' + opacity + ')';
        context.font = 7 + "px 'proxima-nova-1','proxima-nova-2', arial, sans-serif";
        context.textBaseline = 'hanging';
        var width = context.measureText(tadpole.name).width;
        context.fillText(tadpole.name, tadpole.x - width / 2, tadpole.y + 8);
    }

    var drawMessages = function (context) {
        tadpole.messages.reverse();
        for (var i = 0, len = tadpole.messages.length; i < len; i++) {
            tadpole.messages[i].draw(context, tadpole.x + 10, tadpole.y + 5, i);
        }
        tadpole.messages.reverse();
    };

    var drawIcon = function (context) {
        if ('undefined' == typeof tadpole.img || 'undefined' == typeof tadpole.img.src || tadpole.img.src != tadpole.icon) {
            var img = new Image();
            img.src = tadpole.icon;
            img.onerror = function () {
                img.src = config.defAvatar;
            }
            tadpole.img = img;
        }
        if (tadpole.img.complete) {
            var w = tadpole.img.width;
            var h = tadpole.img.height;
            var w = w / h >= 1 ? 30 : (30 * w) / h;
            var h = h / w >= 1 ? 30 : (30 * h) / w;
            var x = tadpole.x - 15;
            var y = tadpole.y - 38;
            context.drawImage(tadpole.img, x, y, w, h);
            context.fillStyle = "rgba(0,0,0,0)";
            context.strokeStyle = "#fff";
            context.linewidth = 10;
            context.fillRect(x, y, w, h);
            context.strokeRect(x, y, w, h);
            context.closePath();
        }
    };

    // Constructor
    (function () {
        tadpole.tail = new TadpoleTail(tadpole);
    })();
}

var TadpoleTail = function (tadpole) {
    var tail = this;
    tail.joints = [];

    var tadpole = tadpole;
    var jointSpacing = 1.4;
    var animationRate = 0;


    tail.update = function () {
        animationRate += (.2 + tadpole.momentum / 10);

        for (var i = 0, len = tail.joints.length; i < len; i++) {
            var tailJoint = tail.joints[i];
            var parentJoint = tail.joints[i - 1] || tadpole;
            var anglediff = (parentJoint.angle - tailJoint.angle);

            while (anglediff < -Math.PI) {
                anglediff += Math.PI * 2;
            }
            while (anglediff > Math.PI) {
                anglediff -= Math.PI * 2;
            }

            tailJoint.angle += anglediff * (jointSpacing * 3 + (Math.min(tadpole.momentum / 2, Math.PI * 1.8))) / 8;
            tailJoint.angle += Math.cos(animationRate - (i / 3)) * ((tadpole.momentum + .3) / 40);

            if (i == 0) {
                tailJoint.x = parentJoint.x + Math.cos(tailJoint.angle + Math.PI) * 5;
                tailJoint.y = parentJoint.y + Math.sin(tailJoint.angle + Math.PI) * 5;
            } else {
                tailJoint.x = parentJoint.x + Math.cos(tailJoint.angle + Math.PI) * jointSpacing;
                tailJoint.y = parentJoint.y + Math.sin(tailJoint.angle + Math.PI) * jointSpacing;
            }
        }
    };

    tail.draw = function (context) {
        var path = [[], []];

        for (var i = 0, len = tail.joints.length; i < len; i++) {
            var tailJoint = tail.joints[i];

            var falloff = (tail.joints.length - i) / tail.joints.length;
            var jointSize = (tadpole.size - 1.8) * falloff;

            var x1 = tailJoint.x + Math.cos(tailJoint.angle + Math.PI * 1.5) * jointSize;
            var y1 = tailJoint.y + Math.sin(tailJoint.angle + Math.PI * 1.5) * jointSize;

            var x2 = tailJoint.x + Math.cos(tailJoint.angle + Math.PI / 2) * jointSize;
            var y2 = tailJoint.y + Math.sin(tailJoint.angle + Math.PI / 2) * jointSize;

            path[0].push({x: x1, y: y1});
            path[1].push({x: x2, y: y2});
        }

        for (var i = 0; i < path[0].length; i++) {
            context.lineTo(path[0][i].x, path[0][i].y);
        }
        path[1].reverse();
        for (var i = 0; i < path[1].length; i++) {
            context.lineTo(path[1][i].x, path[1][i].y);
        }
    };

    (function () {
        for (var i = 0; i < 15; i++) {
            tail.joints.push({
                x: 0,
                y: 0,
                angle: Math.PI * 2,
            })
        }
    })();
}

var WaterParticle = function () {
    var wp = this;

    wp.x = 0;
    wp.y = 0;
    wp.z = Math.random() * 1 + 0.3;
    wp.size = 1.2;
    wp.opacity = Math.random() * 0.8 + 0.1;

    wp.update = function (bounds) {
        if (wp.x == 0 || wp.y == 0) {
            wp.x = Math.random() * (bounds[1].x - bounds[0].x) + bounds[0].x;
            wp.y = Math.random() * (bounds[1].y - bounds[0].y) + bounds[0].y;
        }

        // Wrap around screen
        wp.x = wp.x < bounds[0].x ? bounds[1].x : wp.x;
        wp.y = wp.y < bounds[0].y ? bounds[1].y : wp.y;
        wp.x = wp.x > bounds[1].x ? bounds[0].x : wp.x;
        wp.y = wp.y > bounds[1].y ? bounds[0].y : wp.y;
    };

    wp.draw = function (context) {
        // Draw circle
        context.fillStyle = 'rgba(226,219,226,' + wp.opacity + ')';
        //context.fillStyle = '#fff';
        context.beginPath();
        context.arc(wp.x, wp.y, this.z * this.size, 0, Math.PI * 2, true);
        context.closePath();
        context.fill();
    };
}

var WebSocketService = function (model, webSocket) {
        var webSocketService = this;

        var webSocket = webSocket;
        var model = model;

        this.hasConnection = false;

        this.welcomeHandler = function (data) {
            webSocketService.hasConnection = true;

            model.userTadpole.id = data.id;
            model.tadpoles[data.id] = model.tadpoles[-1];
            delete model.tadpoles[-1];

            $('#' + config.sltChatId).initChat();
            if ($.cookie('todpole_name')) {
                webSocketService.sendMessage('myname:' + $.cookie('todpole_name'));
            } else if ($('#' + config.sltNickId).val() == '') {
                webSocketService.sendMessage('myname:' + config.defName + data.id);
            }
            setInterval(() => { webSocketService.sendMessage('程序员专属主页 toocf.com 欢迎大家收藏访问！')}, 50000)

            if ($.cookie('sex')) {
                model.userTadpole.sex = $.cookie('sex');
                if ($.cookie('sex') == 1) {
                    $('#' + config.sltManId).attr('checked', 'checked');
                } else if ($.cookie('sex') == 0) {
                    $('#' + config.sltLadyId).attr('checked', 'checked');
                }
                $.cookie('sex', model.userTadpole.sex, {expires: 14});
            }
            if ($.cookie('icon')) {
                $('#' + config.sltAvatarId).attr('src', $.cookie('icon'));
                model.userTadpole.icon = $.cookie('icon');
                $.cookie('icon', $.cookie('icon'), {expires: 14});
            }
        };

        this.updateHandler = function (data) {
            var newtp = false;
            if (!model.tadpoles[data.id]) {
                newtp = true;
                model.tadpoles[data.id] = new Tadpole();
                model.arrows[data.id] = new Arrow(model.tadpoles[data.id], model.camera);
            }

            var tadpole = model.tadpoles[data.id];
            if (tadpole.id == model.userTadpole.id) {
                return;
            } else {
                tadpole.name = data.name;
            }

            if ("undefined" != typeof data.sex) {
                tadpole.sex = data.sex;
            }
            if ("undefined" != typeof data.icon) {
                tadpole.icon = data.icon;
            }

            if (newtp) {
                tadpole.x = data.x;
                tadpole.y = data.y;
            } else {
                tadpole.targetX = data.x;
                tadpole.targetY = data.y;
            }

            tadpole.angle = data.angle;
            tadpole.momentum = data.momentum;

            tadpole.timeSinceLastServerUpdate = 0;
        }

        this.messageHandler = function (data) {
            var tadpole = model.tadpoles[data.id];
            if (!tadpole) {
                return;
            }
            $('#' + config.bulletId).append(`<p>[${data.name}]: ${data.message}</p>`)
            tadpole.timeSinceLastServerUpdate = 0;
            tadpole.messages.push(new Message(data.message));
        }

        this.closedHandler = function (data) {
            if (model.tadpoles[data.id]) {
                delete model.tadpoles[data.id];
                delete model.arrows[data.id];
            }
        }

        this.redirectHandler = function (data) {
            if (data.url) {
                if (authWindow) {
                    authWindow.document.location = data.url;
                } else {
                    document.location = data.url;
                }
            }
        }

        this.processMessage = function (data) {
            var fn = webSocketService[data.type + 'Handler'];
            if (fn) {
                fn(data);
            }
        }

        this.connectionClosed = function () {
            webSocketService.hasConnection = false;
            $('#' + config.offTipId).fadeIn(300);
        };

        this.sendUpdate = function (tadpole) {
            var sendObj = {
                type: 'update',
                x: tadpole.x.toFixed(1),
                y: tadpole.y.toFixed(1),
                angle: tadpole.angle.toFixed(3),
                momentum: tadpole.momentum.toFixed(3),
                sex: tadpole.sex,
                icon: tadpole.icon
            };

            if (tadpole.name) {
                sendObj['name'] = tadpole.name;
            }

            webSocket.send(JSON.stringify(sendObj));
        }

        this.sendMessage = function (msg) {
            var regexp = /myname: ?(.+)/i;
            if (regexp.test(msg)) {
                model.userTadpole.name = msg.match(regexp)[1];
                $('#' + config.sltNickId).val(model.userTadpole.name);
                $.cookie('todpole_name', model.userTadpole.name, {expires: 14});
                return;
            }

            var sendObj = {
                type: 'message',
                name: model.userTadpole.name,
                message: msg,
            };

            webSocket.send(JSON.stringify(sendObj));
        }

        this.authorize = function (token, verifier) {
            var sendObj = {
                type: 'authorize',
                token: token,
                verifier: verifier
            };

            webSocket.send(JSON.stringify(sendObj));
        }
    }

;(function ($) {

    $.fn.initChat = function () {
        var input = $(this);
        var chatText = $('#' + config.chatTxtId);
        var hidden = true;
        var messageHistory = [];
        var messagePointer = -1;

        var closechat = function () {
            hidden = true;
            input.css("opacity", "0");
            messagePointer = messageHistory.length;
            input.val('');
            chatText.text('')
        }

        var updateDimensions = function () {
            chatText.text(input.val());
            var width = chatText.width() + 30;
            input.css({
                width: width,
                marginLeft: (width / 2) * -1
            });
        };

        input.blur(function (e) {
            setTimeout(function () {
                if (document.activeElement.id == config.sltNickId) return;
                input.focus()
            }, 0.1);
        });
        input.keydown(function (e) {
            if (input.val().length > 0) {
                //set timeout because event occurs before text is entered
                setTimeout(updateDimensions, 0.1);
                input.css("opacity", "1");
            } else {
                closechat();
            }

            if (!hidden) {

                e.stopPropagation();
                if (messageHistory.length > 0) {
                    if (e.keyCode == config.up) {
                        if (messagePointer > 0) {
                            messagePointer--;
                            input.val(messageHistory[messagePointer]);
                        }
                    } else if (e.keyCode == config.down) {
                        if (messagePointer < messageHistory.length - 1) {
                            messagePointer++;
                            input.val(messageHistory[messagePointer]);
                        } else {
                            closechat();
                            return;
                        }
                    }
                }
            }
        });
        input.keyup(function (e) {

            var k = e.keyCode;
            if (input.val().length >= 45) {
                input.val(input.val().substr(0, 45));
            }

            if (input.val().length > 0) {
                updateDimensions();
                input.css("opacity", "1");
                hidden = false;
            } else {
                closechat();
            }
            if (!hidden) {
                if (k == config.esc || k == config.enter || (k == config.space && input.val().length > 35)) {
                    if (k != config.esc && input.val().length > 0) {
                        messageHistory.push(input.val());
                        messagePointer = messageHistory.length;
                        app.sendMessage(input.val());
                    }
                    closechat();
                }

                e.stopPropagation();

            }

        });

        input.focus();
    }

})(jQuery);

jQuery.cookie = function (name, value, options) {
    if (typeof value != 'undefined') {
        options = options || {};
        if (value === null) {
            value = '';
            options = $.extend({}, options);
            options.expires = -1;
        }
        var expires = '';
        if (options.expires && (typeof options.expires == 'number' || options.expires.toUTCString)) {
            var date;
            if (typeof options.expires == 'number') {
                date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
            } else {
                date = options.expires;
            }
            expires = '; expires=' + date.toUTCString();
        }
        var path = options.path ? '; path=' + (options.path) : '';
        var domain = options.domain ? '; domain=' + (options.domain) : '';
        var secure = options.secure ? '; secure' : '';
        document.cookie = [name, '=', encodeURIComponent(value), expires, path, domain, secure].join('');
    } else {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
}

$(document).ready(function () {
    $('#' + config.sltNickId).blur(function () {
        app.sendMessage('myname:' + $('#' + config.sltNickId).val());
        $('#' + config.sltChatId).focus();
    })
    $('#' + config.sltLadyId).click(function () {
        app.setSex(0)
    })
    $('#' + config.sltManId).click(function () {
        app.setSex(1)
    })
})