(function () {
    'use strict';
    /**
     * T-Rex runner.
     * @param {string} outerContainerId Outer containing element id.
     * @param {Object} opt_config
     * @constructor //Đánh dấu rằng hàm này là hàm khởi tạo (constructor).
     * @export  
     */
    function Runner(outerContainerId, opt_config) {
        // Singleton
        if (Runner.instance_) {
            return Runner.instance_;
        }
        Runner.instance_ = this;

        this.outerContainerEl = document.querySelector(outerContainerId);
        this.containerEl = null;
        this.snackbarEl = null;
        this.detailsButton = this.outerContainerEl.querySelector('#details-button');

        this.config = opt_config || Runner.config;

        this.dimensions = Runner.defaultDimensions;

        this.canvas = null;
        this.canvasCtx = null;

        this.tRex = null;

        this.distanceMeter = null;
        this.distanceRan = 0;

        this.highestScore = 0;

        this.time = 0;
        this.runningTime = 0;
        this.msPerFrame = 1000 / FPS;
        this.currentSpeed = this.config.SPEED;

        this.obstacles = [];

        this.activated = false;
        this.playing = false; 
        this.crashed = false;
        this.paused = false;
        this.inverted = false;
        this.invertTimer = 0;
        this.resizeTimerId_ = null;

        this.playCount = 0;

        // Âm Thanh.
        this.audioBuffer = null;
        this.soundFx = {};
        this.audioContext = null;

        // Hoạt ảnh.
        this.images = {};
        this.imagesLoaded = 0;

        if (this.isDisabled()) {
            this.setupDisabledRunner();
        } else {
            this.loadImages();
        }
    }
    window['Runner'] = Runner;


    /**
     * Chiều rộng trò chơi .
     * @const
     */
    var DEFAULT_WIDTH = 600;

    /**
     * Khung hình trên giây.
     * @const
     */
    var FPS = 80;

    /** @const */
    var IS_HIDPI = window.devicePixelRatio > 1;
    /** @const */
    var IS_IOS = /iPad|iPhone|iPod/.test(window.navigator.platform);
    /** @const */
    var IS_MOBILE = /Android/.test(window.navigator.userAgent) || IS_IOS;
    /** @const */
    var IS_TOUCH_ENABLED = 'ontouchstart' in window;

    /**
     * Cấu hình trò chơi 
     * @enum {number}
     */
    Runner.config = {
        ACCELERATION: 0.001,
        BG_CLOUD_SPEED: 0.2,
        BOTTOM_PAD: 10,
        CLEAR_TIME: 3000,
        CLOUD_FREQUENCY: 0.5,
        GAMEOVER_CLEAR_TIME: 750,
        GAP_COEFFICIENT: 0.6,
        GRAVITY: 0.6,
        INITIAL_JUMP_VELOCITY: 12,
        INVERT_FADE_DURATION: 12000,
        INVERT_DISTANCE: 700,
        MAX_BLINK_COUNT: 3,
        MAX_CLOUDS: 6,
        MAX_OBSTACLE_LENGTH: 3,
        MAX_OBSTACLE_DUPLICATION: 2,
        MAX_SPEED: 13,
        MIN_JUMP_HEIGHT: 35,
        MOBILE_SPEED_COEFFICIENT: 1.2,
        RESOURCE_TEMPLATE_ID: 'audio-resources',
        SPEED: 5,
        SPEED_DROP_COEFFICIENT: 3,
        ARCADE_MODE_INITIAL_TOP_POSITION: 35,
        ARCADE_MODE_TOP_POSITION_PERCENT: 0.1
    };


    /**
     * Kích thước mặc định
     * @enum {string}
     */
    Runner.defaultDimensions = {
        WIDTH: DEFAULT_WIDTH,
        HEIGHT: 150
    };


    /**
     *  Tên lớp CSS.
     * @enum {string}
     */
    Runner.classes = {
        ARCADE_MODE: 'arcade-mode',
        CANVAS: 'runner-canvas',
        CONTAINER: 'runner-container',
        CRASHED: 'crashed',
        ICON: 'icon-offline',
        INVERTED: 'inverted',
        SNACKBAR: 'snackbar',
        SNACKBAR_SHOW: 'snackbar-show',
        TOUCH_CONTROLLER: 'controller'
    };


    /**
     *Bố cục định nghĩa sprite của spritesheet.
     * @enum {Object}
     */
    Runner.spriteDefinition = {
        LDPI: {
            CACTUS_LARGE: { x: 332, y: 2 },
            CACTUS_SMALL: { x: 228, y: 2 },
            CLOUD: { x: 86, y: 2 },
            HORIZON: { x: 2, y: 54 },
            MOON: { x: 484, y: 2 },
            PTERODACTYL: { x: 134, y: 2 },
            RESTART: { x: 2, y: 2 },
            TEXT_SPRITE: { x: 655, y: 2 },
            TREX: { x: 848, y: 2 },
            STAR: { x: 645, y: 2 }
        },
        HDPI: {
            CACTUS_LARGE: { x: 652, y: 2 },
            CACTUS_SMALL: { x: 446, y: 2 },
            CLOUD: { x: 166, y: 2 },
            HORIZON: { x: 2, y: 104 },
            MOON: { x: 954, y: 2 },
            PTERODACTYL: { x: 260, y: 2 },
            RESTART: { x: 2, y: 2 },
            TEXT_SPRITE: { x: 1294, y: 2 },
            TREX: { x: 1678, y: 2 },
            STAR: { x: 1276, y: 2 }
        }
    };


    /**
     * Hiệu ứng âm thanh. Tham chiếu đến ID của thẻ âm thanh trên trang xen kẽ.
     * @enum {string}
     */
    Runner.sounds = {
        BUTTON_PRESS: 'offline-sound-press',
        HIT: 'offline-sound-hit',
        SCORE: 'offline-sound-reached'
    };


    /**
     * Ánh xạ mã khóa.
     * @enum {Object}
     */
    Runner.keycodes = {
        JUMP: { '38': 1, '32': 1 },  // Lên, phím
        DUCK: { '40': 1 },  // Xuống
        RESTART: { '13': 1 }  // Enter
    };


    /**
     * Tên sự kiện của Runner.
     * @enum {string}
     */
    Runner.events = {
        ANIM_END: 'webkitAnimationEnd',
        CLICK: 'click',
        KEYDOWN: 'keydown',
        KEYUP: 'keyup',
        MOUSEDOWN: 'mousedown',
        MOUSEUP: 'mouseup',
        RESIZE: 'resize',
        TOUCHEND: 'touchend',
        TOUCHSTART: 'touchstart',
        VISIBILITY: 'visibilitychange',
        BLUR: 'blur',
        FOCUS: 'focus',
        LOAD: 'load'
    };
  

    Runner.prototype = {
        /**
         * Trứng phục sinh đã bị vô hiệu hóa chưa. Thiết bị đã đăng ký CrOS enterprise.
         * @return {boolean}
         */
        isDisabled: function () {
            // return loadTimeData && loadTimeData.valueExists('disabledEasterEgg');
            return false;
        },

        /**
         * Đối với các trường hợp bị vô hiệu hóa, hãy thiết lập thanh thông báo có thông báo bị vô hiệu hóa.
         */
        setupDisabledRunner: function () {
            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.SNACKBAR;
            this.containerEl.textContent = loadTimeData.getValue('disabledEasterEgg');
            this.outerContainerEl.appendChild(this.containerEl);

            // Hiển thị thông báo khi nhấn phím kích hoạt.
            document.addEventListener(Runner.events.KEYDOWN, function (e) {
                if (Runner.keycodes.JUMP[e.keyCode]) {
                    this.containerEl.classList.add(Runner.classes.SNACKBAR_SHOW);
                    document.querySelector('.icon').classList.add('icon-disabled');
                }
            }.bind(this));
        },

        /**
         * Thiết lập các thiết lập riêng lẻ để gỡ lỗi.
         * @param {string} setting
         * @param {*} value
         */
        updateConfigSetting: function (setting, value) {
            if (setting in this.config && value != undefined) {
                this.config[setting] = value;

                switch (setting) {
                    case 'GRAVITY':
                    case 'MIN_JUMP_HEIGHT':
                    case 'SPEED_DROP_COEFFICIENT':
                        this.tRex.config[setting] = value;
                        break;
                    case 'INITIAL_JUMP_VELOCITY':
                        this.tRex.setJumpVelocity(value);
                        break;
                    case 'SPEED':
                        this.setSpeed(value);
                        break;
                }
            }
        },

        /**
        * Lưu trữ hình ảnh sprite thích hợp từ trang và lấy bảng sprite
        * định nghĩa.
        */
        loadImages: function () {
            if (IS_HIDPI) {
                Runner.imageSprite = document.getElementById('offline-resources-2x');
                this.spriteDef = Runner.spriteDefinition.HDPI;
            } else {
                Runner.imageSprite = document.getElementById('offline-resources-1x');
                this.spriteDef = Runner.spriteDefinition.LDPI;
            }

            if (Runner.imageSprite.complete) {
                this.init();
            } else {
                // Nếu hình ảnh chưa được tải, hãy thêm trình lắng nghe.
                Runner.imageSprite.addEventListener(Runner.events.LOAD,
                    this.init.bind(this));
            }
        },

        /**
        * Tải và giải mã âm thanh mã hóa base 64.
        */
        loadSounds: function () {
            if (!IS_IOS) {
                this.audioContext = new AudioContext();

                var resourceTemplate =
                    document.getElementById(this.config.RESOURCE_TEMPLATE_ID).content;

                for (var sound in Runner.sounds) {
                    var soundSrc =
                        resourceTemplate.getElementById(Runner.sounds[sound]).src;
                    soundSrc = soundSrc.substr(soundSrc.indexOf(',') + 1);
                    var buffer = decodeBase64ToArrayBuffer(soundSrc);

                    // Đồng bộ bất đồng bộ (Async), nên không đảm bảo thứ tự trong mảng.
                    this.audioContext.decodeAudioData(buffer, function (index, audioData) {
                        this.soundFx[index] = audioData;
                    }.bind(this, sound));
                }
            }
        },

        /**
         * Cài đặt tốc độ trò chơi. Điều chỉnh tốc độ phù hợp nếu trên màn hình nhỏ hơn.
         * @param {number} opt_speed
         */
        setSpeed: function (opt_speed) {
            var speed = opt_speed || this.currentSpeed;

            // Giảm tốc độ trên các màn hình điện thoại.
            if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
                var mobileSpeed = speed * this.dimensions.WIDTH / DEFAULT_WIDTH *
                    this.config.MOBILE_SPEED_COEFFICIENT;
                this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed;
            } else if (opt_speed) {
                this.currentSpeed = opt_speed;
            }
        },

        /**
         * Game initialiser.
         */
        init: function () {
            // Ẩn biểu tượng tĩnh.
            document.querySelector('.' + Runner.classes.ICON).style.visibility =
                'hidden';

            this.adjustDimensions(); // Điều chỉnh kích thước màn hình trò chơi.
            this.setSpeed(); // Cài đặt tốc độ trò chơi.
            // Tạo một phần tử div mới để chứa các phần tử trò chơi.
            this.containerEl = document.createElement('div');
            this.containerEl.className = Runner.classes.CONTAINER;

              // Tạo và cấu hình canvas cho người chơi.
            this.canvas = createCanvas(this.containerEl, this.dimensions.WIDTH,
                this.dimensions.HEIGHT, Runner.classes.PLAYER);
            // Lấy ngữ cảnh 2D để vẽ lên canvas.
            this.canvasCtx = this.canvas.getContext('2d');
            this.canvasCtx.fillStyle = '#f7f7f7';
            this.canvasCtx.fill();
            Runner.updateCanvasScaling(this.canvas); // Cập nhật tỷ lệ canvas.

            // Tạo đối tượng Horizon chứa các đám mây, chướng ngại vật và mặt đất.
            this.horizon = new Horizon(this.canvas, this.spriteDef, this.dimensions,
                this.config.GAP_COEFFICIENT);

            // thước đo khoảng cách
            this.distanceMeter = new DistanceMeter(this.canvas,
                this.spriteDef.TEXT_SPRITE, this.dimensions.WIDTH);

            // Vẽ t-rex
            this.tRex = new Trex(this.canvas, this.spriteDef.TREX);

            this.outerContainerEl.appendChild(this.containerEl);

            if (IS_MOBILE) {
                this.createTouchController();
            }

            this.startListening();
            this.update();

            window.addEventListener(Runner.events.RESIZE,
                this.debounceResize.bind(this));
        },

        /**
         * Tạo bộ điều khiển cảm ứng. Một div bao phủ toàn bộ màn hình.
         */
        createTouchController: function () {
            this.touchController = document.createElement('div');
            this.touchController.className = Runner.classes.TOUCH_CONTROLLER;
            this.outerContainerEl.appendChild(this.touchController);
        },

        /**
         * Lọc sự kiện thay đổi kích thước.
         */
        debounceResize: function () {
            if (!this.resizeTimerId_) {
                this.resizeTimerId_ =
                    setInterval(this.adjustDimensions.bind(this), 250);
            }
        },

        /**
         * Điều chỉnh kích thước không gian trò chơi khi thay đổi kích thước cửa sổ.
         */
        adjustDimensions: function () {
            clearInterval(this.resizeTimerId_);
            this.resizeTimerId_ = null;

            var boxStyles = window.getComputedStyle(this.outerContainerEl);
            var padding = Number(boxStyles.paddingLeft.substr(0,
                boxStyles.paddingLeft.length - 2));

            this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2;
            this.dimensions.WIDTH = Math.min(DEFAULT_WIDTH, this.dimensions.WIDTH); // Chế độ arcade
            if (this.activated) {
                this.setArcadeModeContainerScale();
            }
            
            // Vẽ lại các phần tử lên canvas.
            if (this.canvas) {
                this.canvas.width = this.dimensions.WIDTH;
                this.canvas.height = this.dimensions.HEIGHT;

                Runner.updateCanvasScaling(this.canvas);

                this.distanceMeter.calcXPos(this.dimensions.WIDTH);
                this.clearCanvas();
                this.horizon.update(0, 0, true);
                this.tRex.update(0);

                // Container bên ngoài và thước đo khoảng cách.
                if (this.playing || this.crashed || this.paused) {
                    this.containerEl.style.width = this.dimensions.WIDTH + 'px';
                    this.containerEl.style.height = this.dimensions.HEIGHT + 'px';
                    this.distanceMeter.update(0, Math.ceil(this.distanceRan));
                    this.stop();
                } else {
                    this.tRex.draw(0, 0);
                }

                // Bảng thông báo "Game Over".
                if (this.crashed && this.gameOverPanel) {
                    this.gameOverPanel.updateDimensions(this.dimensions.WIDTH);
                    this.gameOverPanel.draw();
                }
            }
        },

        /**
        * Chạy đoạn giới thiệu trò chơi.
        * Chiều rộng của container canvas mở rộng ra toàn bộ chiều rộng.
        */
        playIntro: function () {
            if (!this.activated && !this.crashed) {
                this.playingIntro = true;
                this.tRex.playingIntro = true;

              // Định nghĩa hoạt ảnh CSS.
                var keyframes = '@-webkit-keyframes intro { ' +
                    'from { width:' + Trex.config.WIDTH + 'px }' +
                    'to { width: ' + this.dimensions.WIDTH + 'px }' +
                    '}';
                
                // Tạo một stylesheet để chứa quy tắc keyframe và thêm nó vào phần <head> của HTML.   
                var sheet = document.createElement('style');
                sheet.innerHTML = keyframes;
                document.head.appendChild(sheet);

                this.containerEl.addEventListener(Runner.events.ANIM_END,
                    this.startGame.bind(this));

                this.containerEl.style.webkitAnimation = 'intro .4s ease-out 1 both';
                this.containerEl.style.width = this.dimensions.WIDTH + 'px';

                // if (this.touchController) {
                //     this.outerContainerEl.appendChild(this.touchController);
                // }
                this.playing = true;
                this.activated = true;
            } else if (this.crashed) {
                this.restart();
            }
        },


        /**
        * Cập nhật trạng thái trò chơi sang "đã bắt đầu".
         */
        startGame: function () {
            this.setArcadeMode();
            this.runningTime = 0;
            this.playingIntro = false;
            this.tRex.playingIntro = false;
            this.containerEl.style.webkitAnimation = '';
            this.playCount++;

            // Xử lý khi người dùng chuyển tab, tạm dừng trò chơi khi mất focus.
            document.addEventListener(Runner.events.VISIBILITY,
                this.onVisibilityChange.bind(this));

            window.addEventListener(Runner.events.BLUR,
                this.onVisibilityChange.bind(this));

            window.addEventListener(Runner.events.FOCUS,
                this.onVisibilityChange.bind(this));
        },

        clearCanvas: function () {
            this.canvasCtx.clearRect(0, 0, this.dimensions.WIDTH,
                this.dimensions.HEIGHT);
        },

        /**
        * Cập nhật khung hình trò chơi và lên lịch cho lần cập nhật tiếp theo.
        */
        update: function () {
            this.updatePending = false;

            var now = getTimeStamp();
            var deltaTime = now - (this.time || now);
            this.time = now;

            if (this.playing) {
                this.clearCanvas();
                // Nếu T-Rex đang nhảy, cập nhật trạng thái nhảy.
                if (this.tRex.jumping) {
                    this.tRex.updateJump(deltaTime);
                }

                this.runningTime += deltaTime;
                var hasObstacles = this.runningTime > this.config.CLEAR_TIME;

               // Lần nhảy đầu tiên sẽ kích hoạt đoạn giới thiệu (intro).
                if (this.tRex.jumpCount == 1 && !this.playingIntro) {
                    this.playIntro();
                }

                // Horizon (cảnh nền) sẽ không di chuyển cho đến khi đoạn giới thiệu kết thúc.
                if (this.playingIntro) {
                    this.horizon.update(0, this.currentSpeed, hasObstacles);
                } else {
                     // Nếu trò chơi chưa được kích hoạt, không cập nhật deltaTime.
                    deltaTime = !this.activated ? 0 : deltaTime;
                    this.horizon.update(deltaTime, this.currentSpeed, hasObstacles,
                        this.inverted);
                }

                 // Kiểm tra va chạm giữa T-Rex và chướng ngại vật.
                var collision = hasObstacles &&
                    checkForCollision(this.horizon.obstacles[0], this.tRex);

                if (!collision) {
                    // Nếu không có va chạm, tính toán quãng đường mà T-Rex đã chạy.
                    this.distanceRan += this.currentSpeed * deltaTime / this.msPerFrame;
                     // Nếu chưa đạt tốc độ tối đa, tăng tốc độ.
                    if (this.currentSpeed < this.config.MAX_SPEED) {
                        this.currentSpeed += this.config.ACCELERATION;
                    }
                } else {
                     // Nếu có va chạm, kết thúc trò chơi
                    this.gameOver();
                }
                // Cập nhật thước đo khoảng cách và kiểm tra nếu đạt thành tích.
                var playAchievementSound = this.distanceMeter.update(deltaTime,
                    Math.ceil(this.distanceRan));

                if (playAchievementSound) {
                    this.playSound(this.soundFx.SCORE);// Phát âm thanh thành tích khi đạt điểm cao.
                }

              // Chế độ ban đêm.
                if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
                    this.invertTimer = 0;// Đặt lại bộ đếm thời gian chuyển đổi chế độ ban đêm.
                    this.invertTrigger = false; // Tắt tín hiệu kích hoạt chế độ ban đêm.
                    this.invert(); // Đảo ngược màu sắc (chuyển sang chế độ ban đêm).
                } else if (this.invertTimer) {
                    this.invertTimer += deltaTime;  // Nếu bộ đếm thời gian đang chạy, tăng thời gian lên theo deltaTime.
                } else {
                    var actualDistance =
                        this.distanceMeter.getActualDistance(Math.ceil(this.distanceRan));

                    if (actualDistance > 0) {
                        this.invertTrigger = !(actualDistance %
                            this.config.INVERT_DISTANCE);

                        if (this.invertTrigger && this.invertTimer === 0) {
            this.invertTimer += deltaTime;  // Bắt đầu bộ đếm thời gian cho chế độ ban đêm.
            this.invert();  // Đảo ngược màu sắc (chuyển sang chế độ ban đêm).
                        }
                    }
                }
            }
            // Cập nhật T-Rex nếu trò chơi đang chơi hoặc T-Rex chưa đạt số lần nháy mắt tối đa.
            if (this.playing || (!this.activated &&
                this.tRex.blinkCount < Runner.config.MAX_BLINK_COUNT)) {
                this.tRex.update(deltaTime);// Cập nhật trạng thái của T-Rex.
                this.scheduleNextUpdate();// Lên lịch cho lần cập nhật tiếp theo.
            }
        },

        /**
         * Hàm xử lý sự kiện.
         */
        handleEvent: function (e) {
            return (function (evtType, events) {
                switch (evtType) {
                    case events.KEYDOWN:
                    case events.TOUCHSTART:
                    case events.MOUSEDOWN:
                        this.onKeyDown(e);// Gọi hàm xử lý khi có sự kiện nhấn phím, chạm màn hình, hoặc nhấn chuột.
                        break;
                    case events.KEYUP:
                    case events.TOUCHEND:
                    case events.MOUSEUP:
                        this.onKeyUp(e); // Gọi hàm xử lý khi có sự kiện nhả phím, kết thúc chạm màn hình, hoặc nhả chuột.
                        break;
                }
            }.bind(this))(e.type, Runner.events);// Gọi hàm xử lý sự kiện, truyền loại sự kiện và đối tượng sự kiện.
        },

        /**
         * Liên kết các sự kiện bàn phím / chuột / cảm ứng (touch) cần thiết.
         */
        startListening: function () {
            // Bàn phím.
            document.addEventListener(Runner.events.KEYDOWN, this);
            document.addEventListener(Runner.events.KEYUP, this);

            if (IS_MOBILE) {
               // Thiết bị di động 
                this.touchController.addEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.addEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.addEventListener(Runner.events.TOUCHSTART, this);
            } else {
                 // Chuột.
                document.addEventListener(Runner.events.MOUSEDOWN, this);
                document.addEventListener(Runner.events.MOUSEUP, this);
            }
        },

        /**
         * Loại bỏ tất cả các trình lắng nghe sự kiện.
         */
        stopListening: function () {
            document.removeEventListener(Runner.events.KEYDOWN, this);
            document.removeEventListener(Runner.events.KEYUP, this);

            if (IS_MOBILE) {
                 // Thiết bị di động.
                this.touchController.removeEventListener(Runner.events.TOUCHSTART, this);
                this.touchController.removeEventListener(Runner.events.TOUCHEND, this);
                this.containerEl.removeEventListener(Runner.events.TOUCHSTART, this);
            } else {
                 // Máy tính để bàn, xóa sự kiện chuột.
                document.removeEventListener(Runner.events.MOUSEDOWN, this);
                document.removeEventListener(Runner.events.MOUSEUP, this);
            }
        },

        /**
         *  Xử lý sự kiện khi nhấn phím.
         * @param {Event} e
         */
        onKeyDown: function (e) {
              // Ngăn việc cuộn trang mặc định khi chạm vào màn hình trên thiết bị di động.
            if (IS_MOBILE && this.playing) {
                e.preventDefault(); // Ngừng hành động mặc định của sự kiện (ngăn cuộn trang).
            }
            // Kiểm tra điều kiện nếu không phải nút chi tiết và không bị va chạm.
            if (e.target != this.detailsButton) {
                if (!this.crashed && (Runner.keycodes.JUMP[e.keyCode] ||
                    e.type == Runner.events.TOUCHSTART)) {
                    if (!this.playing) {
                        // Nếu game chưa bắt đầu, tải âm thanh và bắt đầu chơi.
                        this.loadSounds();
                        this.playing = true;
                        this.update();// Cập nhật game khi bắt đầu chơi.
                        // Kiểm tra trang lỗi và theo dõi Easter egg nếu có.
                        if (window.errorPageController) {
                            errorPageController.trackEasterEgg();
                        }
                    }
                    // Phát âm thanh và cho nhân vật nhảy khi bắt đầu chơi lần đầu tiên.
                    if (!this.tRex.jumping && !this.tRex.ducking) {
                        this.playSound(this.soundFx.BUTTON_PRESS);// Phát âm thanh khi nhấn nút.
                        this.tRex.startJump(this.currentSpeed); // Tạo hành động nhảy cho nhân vật.
                    }
                }
                // Nếu game đã va chạm và chạm vào màn hình, khởi động lại game.
                if (this.crashed && e.type == Runner.events.TOUCHSTART &&
                    e.currentTarget == this.containerEl) {
                    this.restart();// Khởi động lại game.
                }
            }
            // Nếu game đang chơi và chưa bị va chạm, xử lý sự kiện nhấn phím để cúi người.
            if (this.playing && !this.crashed && Runner.keycodes.DUCK[e.keyCode]) {
                e.preventDefault();
                if (this.tRex.jumping) {
                // Giảm tốc độ khi nhân vật đang nhảy, chỉ kích hoạt khi không nhấn phím nhảy.
                    this.tRex.setSpeedDrop();
                } else if (!this.tRex.jumping && !this.tRex.ducking) {
                    // Cúi người khi nhân vật không nhảy và không cúi.
                    this.tRex.setDuck(true);
                }
            }
        },


        /**
         * Xử lý sự kiện nhả phím.
         * @param {Event} e
         */
        onKeyUp: function (e) {
            var keyCode = String(e.keyCode);// Lấy mã phím từ sự kiện.
            var isjumpKey = Runner.keycodes.JUMP[keyCode] ||// Kiểm tra nếu phím là phím nhảy.
                e.type == Runner.events.TOUCHEND ||// Kiểm tra nếu sự kiện là TOUCHEND (chạm kết thúc).
                e.type == Runner.events.MOUSEDOWN;// Kiểm tra nếu sự kiện là MOUSEDOWN (nhấn chuột).
            // Nếu game đang chạy và nhấn phím nhảy, kết thúc hành động nhảy.
            if (this.isRunning() && isjumpKey) {
                this.tRex.endJump(); // Kết thúc nhảy.
            } else if (Runner.keycodes.DUCK[keyCode]) {// Nếu phím nhấn là cúi người.
                this.tRex.speedDrop = false;// Hủy bỏ giảm tốc độ.
                this.tRex.setDuck(false);// Dừng hành động cúi người.
            } else if (this.crashed) {
                 // Kiểm tra xem có đủ thời gian để phím nhảy có thể khởi động lại game không.
                var deltaTime = getTimeStamp() - this.time;

                if (Runner.keycodes.RESTART[keyCode] || this.isLeftClickOnCanvas(e) ||
                    (deltaTime >= this.config.GAMEOVER_CLEAR_TIME &&
                        Runner.keycodes.JUMP[keyCode])) {
                    this.restart();// Khởi động lại game.
                }
            } else if (this.paused && isjumpKey) {
                // Reset trạng thái nhảy.
                this.tRex.reset();
                this.play();// Tiếp tục trò chơi.
            }
        },

        /**
         * Kiểm tra xem sự kiện có phải là một cú nhấp chuột trái trên canvas không.
         * Trên Windows, nhấp chuột phải cũng được ghi nhận là một cú nhấp chuột.
         * @param {Event} e
         * @return {boolean}
         */
        isLeftClickOnCanvas: function (e) {
            return e.button != null && e.button < 2 &&
                e.type == Runner.events.MOUSEUP && e.target == this.canvas;
        },

        /**
         * Bao bọc việc gọi RequestAnimationFrame.
         */
        scheduleNextUpdate: function () {
            if (!this.updatePending) {
                this.updatePending = true;
                this.raqId = requestAnimationFrame(this.update.bind(this));
            }
        },

        /**
         *  Kiểm tra xem game có đang chạy không.
         * @return {boolean}
         */
        isRunning: function () {
            return !!this.raqId;
        },

        /**
         * Trạng thái game over.
         */
        gameOver: function () {
            this.playSound(this.soundFx.HIT);
            vibrate(200);

            this.stop();
            this.crashed = true;
            this.distanceMeter.acheivement = false;

            this.tRex.update(100, Trex.status.CRASHED);

              // Hiển thị bảng game over.
            if (!this.gameOverPanel) {
                this.gameOverPanel = new GameOverPanel(this.canvas,
                    this.spriteDef.TEXT_SPRITE, this.spriteDef.RESTART,
                    this.dimensions);
            } else {
                this.gameOverPanel.draw();
            }

          // Cập nhật điểm số cao nhất.
            if (this.distanceRan > this.highestScore) {
                this.highestScore = Math.ceil(this.distanceRan);
                this.distanceMeter.setHighScore(this.highestScore);
            }

            // Đặt lại đồng hồ thời gian.
            this.time = getTimeStamp();
        },

        stop: function () {
            this.playing = false;
            this.paused = true;
            cancelAnimationFrame(this.raqId);
            this.raqId = 0;
        },

        play: function () {
            if (!this.crashed) {
                this.playing = true;
                this.paused = false;
                this.tRex.update(0, Trex.status.RUNNING);
                this.time = getTimeStamp();
                this.update();
            }
        },

        restart: function () {
            if (!this.raqId) {
                this.playCount++;
                this.runningTime = 0;
                this.playing = true;
                this.crashed = false;
                this.distanceRan = 0;
                this.setSpeed(this.config.SPEED);
                this.time = getTimeStamp();
                this.containerEl.classList.remove(Runner.classes.CRASHED);
                this.clearCanvas();
                this.distanceMeter.reset(this.highestScore);
                this.horizon.reset();
                this.tRex.reset();
                this.playSound(this.soundFx.BUTTON_PRESS);
                this.invert(true);
                this.update();
            }
        },
        
        /**
         *Ẩn thông báo "không có kết nối mạng" cho trải nghiệm toàn màn hình.
         */
        setArcadeMode() {
            document.body.classList.add(Runner.classes.ARCADE_MODE);
            this.setArcadeModeContainerScale();
        },

        /**
         * Thiết lập tỉ lệ cho chế độ Arcade.
         */
        setArcadeModeContainerScale() {
            const windowHeight = window.innerHeight;
            const scaleHeight = windowHeight / this.dimensions.HEIGHT;
            const scaleWidth = window.innerWidth / this.dimensions.WIDTH;
            const scale = Math.max(1, Math.min(scaleHeight, scaleWidth));
            const scaledCanvasHeight = this.dimensions.HEIGHT * scale;
           // Định vị container trò chơi cách đỉnh cửa sổ 10% của không gian khả dụng,
           // trừ đi chiều cao container trò chơi.
            const translateY = Math.ceil(Math.max(0, (windowHeight - scaledCanvasHeight -
                                                      Runner.config.ARCADE_MODE_INITIAL_TOP_POSITION) *
                                                  Runner.config.ARCADE_MODE_TOP_POSITION_PERCENT)) *
                  window.devicePixelRatio;

            const cssScale = scale; // Thiết lập tỉ lệ CSS.
            this.containerEl.style.transform =
                'scale(' + cssScale + ') translateY(' + translateY + 'px)';
        },
        
        /**
         * Tạm dừng trò chơi nếu tab không ở trạng thái hoạt động.
         */
        onVisibilityChange: function (e) {
            if (document.hidden || document.webkitHidden || e.type == 'blur' ||
                document.visibilityState != 'visible') {
                this.stop();
            } else if (!this.crashed) {
                this.tRex.reset();
                this.play();
            }
        },

        /**
         * Phát âm thanh.
         * @param {SoundBuffer} soundBuffer
         */
        playSound: function (soundBuffer) {
            if (soundBuffer) {
                var sourceNode = this.audioContext.createBufferSource();
                sourceNode.buffer = soundBuffer;
                sourceNode.connect(this.audioContext.destination);
                sourceNode.start(0);
            }
        },

        /**
         * Đảo ngược màu sắc của trang hoặc canvas hiện tại.
         * @param {boolean} Whether reset Xác định có đặt lại màu sắc hay không.
         */
        invert: function (reset) {
            if (reset) {
                document.body.classList.toggle(Runner.classes.INVERTED, false);
                this.invertTimer = 0;
                this.inverted = false;
            } else {
                this.inverted = document.body.classList.toggle(Runner.classes.INVERTED,
                    this.invertTrigger);
            }
        }
    };


    /**
     * Cập nhật kích thước canvas, tính đến tỉ lệ pixel của thiết bị và trình duyệt.
     *
     * Tham khảo bài viết của Paul Lewis:
     * http://www.html5rocks.com/en/tutorials/canvas/hidpi/
     *
     * @param {HTMLCanvasElement} canvas
     * @param {number} opt_width
     * @param {number} opt_height
     * @return {boolean} Whether the canvas was scaled.
     */
    Runner.updateCanvasScaling = function (canvas, opt_width, opt_height) {
        var context = canvas.getContext('2d');

         // Lấy các tỉ lệ pixel hiện tại.
        var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1;
        var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1;
        var ratio = devicePixelRatio / backingStoreRatio;

        // Nếu tỉ lệ thiết bị và trình duyệt khác nhau, thực hiện upscale canvas.
        if (devicePixelRatio !== backingStoreRatio) {
            var oldWidth = opt_width || canvas.width;
            var oldHeight = opt_height || canvas.height;

            canvas.width = oldWidth * ratio;
            canvas.height = oldHeight * ratio;

            canvas.style.width = oldWidth + 'px';
            canvas.style.height = oldHeight + 'px';

            // Điều chỉnh ngữ cảnh để phù hợp với kích thước đã thay đổi.
            context.scale(ratio, ratio);
            return true;
        } else if (devicePixelRatio == 1) {
             // Đặt lại kích thước canvas để sửa lỗi khi zoom trang thay đổi tỉ lệ pixel.
            canvas.style.width = canvas.width + 'px';
            canvas.style.height = canvas.height + 'px';
        }
        return false;
    };


    /**
     * Lấy một số ngẫu nhiên trong khoảng
     * @param {number} min
     * @param {number} max
     * @param {number}
     */
    function getRandomNum(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }


    /**
     * Kích hoạt rung trên các thiết bị di động.
     * @param {number} duration duration Thời gian rung (tính bằng mili giây).
     */
    function vibrate(duration) {
        if (IS_MOBILE && window.navigator.vibrate) {
            window.navigator.vibrate(duration);
        }
    }


    /**
     * Tạo phần tử canvas.
     * @param {HTMLElement} container container Phần tử HTML để thêm canvas vào.
     * @param {number} width
     * @param {number} height
     * @param {string} opt_classname
     * @return {HTMLCanvasElement}
     */
    function createCanvas(container, width, height, opt_classname) {
        var canvas = document.createElement('canvas');
        canvas.className = opt_classname ? Runner.classes.CANVAS + ' ' +
            opt_classname : Runner.classes.CANVAS;
        canvas.width = width;
        canvas.height = height;
        container.appendChild(canvas);

        return canvas;
    }


    /**
     * Giải mã âm thanh base64 thành ArrayBuffer được sử dụng bởi Web Audio..
     * @param {string} base64String base64String Chuỗi âm thanh base64.
     */
    function decodeBase64ToArrayBuffer(base64String) {
        var len = (base64String.length / 4) * 3;
        var str = atob(base64String);
        var arrayBuffer = new ArrayBuffer(len);
        var bytes = new Uint8Array(arrayBuffer);

        for (var i = 0; i < len; i++) {
            bytes[i] = str.charCodeAt(i);
        }
        return bytes.buffer;
    }


    /**
     * Trả về dấu thời gian hiện tại.
     * @return {number}
     */
    function getTimeStamp() {
        return IS_IOS ? new Date().getTime() : performance.now();
    }


    //******************************************************************************


    /**
     * Bảng kết thúc trò chơi.
     * @param {!HTMLCanvasElement} canvas
     * @param {Object} textImgPos
     * @param {Object} restartImgPos
     * @param {!Object} dimensions dimensions Kích thước của canvas.
     * @constructor
     */
    function GameOverPanel(canvas, textImgPos, restartImgPos, dimensions) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.canvasDimensions = dimensions;
        this.textImgPos = textImgPos;
        this.restartImgPos = restartImgPos;
        this.draw();
    };


    /**
     * Các kích thước được sử dụng trong bảng.
     * @enum {number}
     */
    GameOverPanel.dimensions = {
        TEXT_X: 0,
        TEXT_Y: 13,
        TEXT_WIDTH: 191,
        TEXT_HEIGHT: 11,
        RESTART_WIDTH: 36,
        RESTART_HEIGHT: 32
    };


    GameOverPanel.prototype = {
        /**
         * Cập nhật kích thước bảng.
         * @param {number} width width Chiều rộng mới của canvas.
         * @param {number} opt_height  opt_height Chiều cao mới của canvas (tùy chọn).
         */
        updateDimensions: function (width, opt_height) {
            this.canvasDimensions.WIDTH = width;
            if (opt_height) {
                this.canvasDimensions.HEIGHT = opt_height;
            }
        },

        /**
         *  Vẽ bảng kết thúc trò chơi.
         */
        draw: function () {
            var dimensions = GameOverPanel.dimensions;

            var centerX = this.canvasDimensions.WIDTH / 2;

            // Văn bản "Game Over".
            var textSourceX = dimensions.TEXT_X;
            var textSourceY = dimensions.TEXT_Y;
            var textSourceWidth = dimensions.TEXT_WIDTH;
            var textSourceHeight = dimensions.TEXT_HEIGHT;

            var textTargetX = Math.round(centerX - (dimensions.TEXT_WIDTH / 2));
            var textTargetY = Math.round((this.canvasDimensions.HEIGHT - 25) / 3);
            var textTargetWidth = dimensions.TEXT_WIDTH;
            var textTargetHeight = dimensions.TEXT_HEIGHT;

            var restartSourceWidth = dimensions.RESTART_WIDTH;
            var restartSourceHeight = dimensions.RESTART_HEIGHT;
            var restartTargetX = centerX - (dimensions.RESTART_WIDTH / 2);
            var restartTargetY = this.canvasDimensions.HEIGHT / 2;

            if (IS_HIDPI) {
                textSourceY *= 2;
                textSourceX *= 2;
                textSourceWidth *= 2;
                textSourceHeight *= 2;
                restartSourceWidth *= 2;
                restartSourceHeight *= 2;
            }

            textSourceX += this.textImgPos.x;
            textSourceY += this.textImgPos.y;

            // Vẽ văn bản "Game Over" từ hình sprite.
            this.canvasCtx.drawImage(Runner.imageSprite,
                textSourceX, textSourceY, textSourceWidth, textSourceHeight,
                textTargetX, textTargetY, textTargetWidth, textTargetHeight);

             // Vẽ nút khởi động lại.
            this.canvasCtx.drawImage(Runner.imageSprite,
                this.restartImgPos.x, this.restartImgPos.y,
                restartSourceWidth, restartSourceHeight,
                restartTargetX, restartTargetY, dimensions.RESTART_WIDTH,
                dimensions.RESTART_HEIGHT);
        }
    };

    /**
     * Kiểm tra va chạm..
     * @param {!Obstacle} obstacle obstacle Vật cản.
     * @param {!Trex} tRex Đối tượng T-rex.
     * @param {HTMLCanvasContext} opt_canvasCtx opt_canvasCtx Ngữ cảnh canvas tùy chọn để vẽ các hộp va chạm.
     *    Mảng các hộp va chạm.
     * @return {Array<CollisionBox>}
     */
    function checkForCollision(obstacle, tRex, opt_canvasCtx) {
        var obstacleBoxXPos = Runner.defaultDimensions.WIDTH + obstacle.xPos;

         // Điều chỉnh hộp va chạm vì có một viền trắng 1 pixel xung quanh t-rex và vật cản.
        var tRexBox = new CollisionBox(
            tRex.xPos + 1, // Vị trí X của T-rex.
            tRex.yPos + 1, // Vị trí Y của T-rex.
            tRex.config.WIDTH - 2, // Chiều rộng của hộp va chạm của T-rex.
            tRex.config.HEIGHT - 2); // Chiều cao của hộp va chạm của T-rex.

        var obstacleBox = new CollisionBox(
            obstacle.xPos + 1,  // Vị trí X của vật cản.
            obstacle.yPos + 1, // Vị trí Y của vật cản.
            obstacle.typeConfig.width * obstacle.size - 20, // Chiều rộng của hộp va chạm của vật cản.
            obstacle.typeConfig.height - 20); // Chiều cao của hộp va chạm của vật cản. 

          // Kiểm tra hộp va chạm ngoài cùng (dùng cho chế độ debug).
        if (opt_canvasCtx) {
            drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox); // Vẽ hộp va chạm nếu ngữ cảnh canvas có sẵn.
        }

        // Kiểm tra va chạm cơ bản với các giới hạn ngoài của các hộp.
        if (boxCompare(tRexBox, obstacleBox)) {
            var collisionBoxes = obstacle.collisionBoxes;
            var tRexCollisionBoxes = tRex.ducking ?
                Trex.collisionBoxes.DUCKING : Trex.collisionBoxes.RUNNING; // Kiểm tra nếu T-rex đang cúi.

            // Kiểm tra va chạm chi tiết theo trục thẳng hàng (axis-aligned box).
            for (var t = 0; t < tRexCollisionBoxes.length; t++) {
                for (var i = 0; i < collisionBoxes.length; i++) {
                     // Điều chỉnh hộp va chạm về vị trí thực tế.
                    var adjTrexBox =
                        createAdjustedCollisionBox(tRexCollisionBoxes[t], tRexBox);
                    var adjObstacleBox =
                        createAdjustedCollisionBox(collisionBoxes[i], obstacleBox);
                    var crashed = boxCompare(adjTrexBox, adjObstacleBox);

                    // Vẽ hộp va chạm để kiểm tra trong chế độ debug.
                    if (opt_canvasCtx) {
                        drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox);
                    }

                    if (crashed) {
                        return [adjTrexBox, adjObstacleBox];  // Nếu có va chạm, trả về các hộp va chạm đã điều chỉnh.
                    }
                }
            }
        }
        return false; // Không có va chạm nếu không trả về hộp va chạm.
    };


    /**
     *  Điều chỉnh hộp va chạm.
     * @param {!CollisionBox} box Hộp va chạm ban đầu.
     * @param {!CollisionBox} adjustment Hộp điều chỉnh.
     * @return {CollisionBox} Đối tượng hộp va chạm đã điều chỉnh.
     */
    function createAdjustedCollisionBox(box, adjustment) {
        return new CollisionBox(
            box.x + adjustment.x,
            box.y + adjustment.y,
            box.width,
            box.height);
    };


    /**
     * Vẽ các hộp va chạm để kiểm tra trong chế độ debug.
     */
    function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
        canvasCtx.save();
        canvasCtx.strokeStyle = '#f00';
        canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height);

        canvasCtx.strokeStyle = '#0f0';
        canvasCtx.strokeRect(obstacleBox.x, obstacleBox.y,
            obstacleBox.width, obstacleBox.height);
        canvasCtx.restore();
    };


    /**
     * So sánh hai hộp va chạm để kiểm tra va chạm.
     * @param {CollisionBox} tRexBox
     * @param {CollisionBox} obstacleBox
     * @return {boolean} Kiểm tra xem các hộp có giao nhau hay không.
     */
    function boxCompare(tRexBox, obstacleBox) {
        var crashed = false; // Biến để kiểm tra va chạm.
        var tRexBoxX = tRexBox.x;
        var tRexBoxY = tRexBox.y;

        var obstacleBoxX = obstacleBox.x;
        var obstacleBoxY = obstacleBox.y;

        // Phương pháp Hộp Bao Ngắn Trục (Axis-Aligned Bounding Box).
        if (tRexBox.x < obstacleBoxX + obstacleBox.width &&
            tRexBox.x + tRexBox.width > obstacleBoxX &&
            tRexBox.y < obstacleBox.y + obstacleBox.height &&
            tRexBox.height + tRexBox.y > obstacleBox.y) {
            crashed = true; // Nếu các hộp giao nhau, va chạm xảy ra.
        }

        return crashed; // Trả về kết quả va chạm.
    };


    //******************************************************************************

    /**
     *  Đối tượng hộp va chạm.
     * @param {number} x Vị trí theo trục X.
     * @param {number} y Vị trí theo trục Y.
     * @param {number} w Chiều rộng.
     * @param {number} h Chiều cao.
     */
    function CollisionBox(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
    };


    //******************************************************************************

    /**
     * Vật cản (Obstacle).
     * @param {HTMLCanvasCtx} canvasCtx
     * @param {Obstacle.type} type Loại vật cản.
     * @param {Object} spritePos Vị trí vật cản trong sprite.
     * @param {Object} dimensions  Kích thước của vật cản.
     * @param {number} gapCoefficientHệ số nhân trong việc xác định khoảng cách.
     * @param {number} speed
     * @param {number} opt_xOffset
     */
    function Obstacle(canvasCtx, type, spriteImgPos, dimensions,
        gapCoefficient, speed, opt_xOffset) {

        this.canvasCtx = canvasCtx;
        this.spritePos = spriteImgPos;
        this.typeConfig = type;
        this.gapCoefficient = gapCoefficient;
        this.size = getRandomNum(1, Obstacle.MAX_OBSTACLE_LENGTH);
        this.dimensions = dimensions;
        this.remove = false;
        this.xPos = dimensions.WIDTH + (opt_xOffset || 0);
        this.yPos = 0;
        this.width = 0;
        this.collisionBoxes = [];
        this.gap = 0;
        this.speedOffset = 0;

        // Đối với các vật cản có hoạt hình.
        this.currentFrame = 0;
        this.timer = 0;

        this.init(speed);
    };

    /**
     * Hệ số tính toán khoảng cách tối đa.
     * @const
     */
    Obstacle.MAX_GAP_COEFFICIENT = 1.5;

    /**
     * Số lượng tối đa các vật cản trong nhóm.
     * @const
     */
    Obstacle.MAX_OBSTACLE_LENGTH = 3,


        Obstacle.prototype = {
            /**
             * Khởi tạo DOM cho vật cản.
             * @param {number} speed
             */
            init: function (speed) {
                this.cloneCollisionBoxes();

                  // Chỉ cho phép thay đổi kích thước nếu đạt được tốc độ yêu cầu.
                if (this.size > 1 && this.typeConfig.multipleSpeed > speed) {
                    this.size = 1;
                }

                this.width = this.typeConfig.width * this.size;

                // Kiểm tra xem vật cản có thể được đặt ở các độ cao khác nhau không.
                if (Array.isArray(this.typeConfig.yPos)) {
                    var yPosConfig = IS_MOBILE ? this.typeConfig.yPosMobile :
                        this.typeConfig.yPos;
                    this.yPos = yPosConfig[getRandomNum(0, yPosConfig.length - 1)];
                } else {
                    this.yPos = this.typeConfig.yPos;
                }

                this.draw();

                if (this.size > 1) {
                    this.collisionBoxes[1].width = this.width - this.collisionBoxes[0].width -
                        this.collisionBoxes[2].width;
                    this.collisionBoxes[2].x = this.width - this.collisionBoxes[2].width;
                }

                 // Đối với các vật cản có tốc độ khác với mặt đất.
                if (this.typeConfig.speedOffset) {
                    this.speedOffset = Math.random() > 0.5 ? this.typeConfig.speedOffset :
                        -this.typeConfig.speedOffset;
                }

                this.gap = this.getGap(this.gapCoefficient, speed);
            },

            /**
             * Vẽ và cắt vật cản theo kích thước.
             */
            draw: function () {
                var sourceWidth = this.typeConfig.width;
                var sourceHeight = this.typeConfig.height;

                if (IS_HIDPI) {
                    sourceWidth = sourceWidth * 2;
                    sourceHeight = sourceHeight * 2;
                }

                // Vị trí theo trục X trong sprite.
                var sourceX = (sourceWidth * this.size) * (0.5 * (this.size - 1)) +
                    this.spritePos.x;

                // Các khung hình hoạt hình.
                if (this.currentFrame > 0) {
                    sourceX += sourceWidth * this.currentFrame;
                }

                this.canvasCtx.drawImage(Runner.imageSprite,
                    sourceX, this.spritePos.y,
                    sourceWidth * this.size, sourceHeight,
                    this.xPos, this.yPos,
                    this.typeConfig.width * this.size, this.typeConfig.height);
            },

            /**
             * Cập nhật khung hình vật cản.
             * @param {number} deltaTime
             * @param {number} speed
             */
            update: function (deltaTime, speed) {
                if (!this.remove) {
                    if (this.typeConfig.speedOffset) {
                        speed += this.speedOffset;
                    }
                    this.xPos -= Math.floor((speed * FPS / 1000) * deltaTime);

                    // Cập nhật khung hình
                    if (this.typeConfig.numFrames) {
                        this.timer += deltaTime;
                        if (this.timer >= this.typeConfig.frameRate) {
                            this.currentFrame =
                                this.currentFrame == this.typeConfig.numFrames - 1 ?
                                    0 : this.currentFrame + 1;
                            this.timer = 0;
                        }
                    }
                    this.draw();

                    if (!this.isVisible()) {
                        this.remove = true;
                    }
                }
            },

            /**
              * Tính toán kích thước khoảng cách ngẫu nhiên.
              * - Khoảng cách tối thiểu rộng ra khi tốc độ tăng.
             * @param {number} gapCoefficient
             * @param {number} speed
             * @return {number} Kích thước khoảng cách.
             */
            getGap: function (gapCoefficient, speed) {
                var minGap = Math.round(this.width * speed +
                    this.typeConfig.minGap * gapCoefficient);
                var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT);
                return getRandomNum(minGap, maxGap);
            },

            /**
             * CKiểm tra xem vật cản có đang hiển thị hay không.
             * @return {boolean} Trả về true nếu vật cản còn trong khu vực trò chơi.
             */
            isVisible: function () {
                return this.xPos + this.width > 0;
            },

            /**
             * Tạo một bản sao của các hộp va chạm, vì chúng sẽ thay đổi tùy theo
             * loại và kích thước của vật cản.
             */
            cloneCollisionBoxes: function () {
                var collisionBoxes = this.typeConfig.collisionBoxes;

                for (var i = collisionBoxes.length - 1; i >= 0; i--) {
                    this.collisionBoxes[i] = new CollisionBox(collisionBoxes[i].x,
                        collisionBoxes[i].y, collisionBoxes[i].width,
                        collisionBoxes[i].height);
                }
            }
        };


    /**
     * Định nghĩa vật cản.
     * minGap: khoảng cách tối thiểu giữa các vật cản (tính bằng pixel).
     * multipleSpeed: Tốc độ tại đó vật cản có thể xuất hiện nhiều lần.
     * speedOffset: tốc độ nhanh hơn / chậm hơn so với đường chân trời.
     * minSpeed: Tốc độ tối thiểu mà vật cản có thể xuất hiện.
     */
    Obstacle.types = [
        {
            type: 'CACTUS_SMALL',
            width: 17,
            height: 35,
            yPos: 105,
            multipleSpeed: 4,
            minGap: 120,
            minSpeed: 0,
            collisionBoxes: [
                new CollisionBox(0, 7, 5, 27),
                new CollisionBox(4, 0, 6, 34),
                new CollisionBox(10, 4, 7, 14)
            ]
        },
        {
            type: 'CACTUS_LARGE',
            width: 25,
            height: 50,
            yPos: 90,
            multipleSpeed: 7,
            minGap: 120,
            minSpeed: 0,
            collisionBoxes: [
                new CollisionBox(0, 12, 7, 38),
                new CollisionBox(8, 0, 7, 49),
                new CollisionBox(13, 10, 10, 38)
            ]
        },
        {
            type: 'PTERODACTYL',
            width: 46,
            height: 40,
            yPos: [100, 75, 50], // Chiều cao thay đổi.
            yPosMobile: [100, 50], // Chiều cao thay đổi trên thiết bị di động.
            multipleSpeed: 999,
            minSpeed: 8.5,
            minGap: 150,
            collisionBoxes: [
                new CollisionBox(15, 15, 16, 5),
                new CollisionBox(18, 21, 24, 6),
                new CollisionBox(2, 14, 4, 3),
                new CollisionBox(6, 10, 4, 7),
                new CollisionBox(10, 8, 6, 9)
            ],
            numFrames: 2,
            frameRate: 1000 / 6,
            speedOffset: .8
        }
    ];


    //******************************************************************************
    /**
     * Nhân vật T-rex trong trò chơi
     * @param {HTMLCanvas} canvas
     * @param {Object} spritePos spritePos Vị trí trong hình ảnh sprite.
     * @constructor
     */
    function Trex(canvas, spritePos) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.spritePos = spritePos;
        this.xPos = 0;
        this.yPos = 0;
        // Vị trí khi T-rex ở trên mặt đất.
        this.groundYPos = 0;
        this.currentFrame = 0;
        this.currentAnimFrames = [];
        this.blinkDelay = 0;
        this.blinkCount = 0;
        this.animStartTime = 0;
        this.timer = 0;
        this.msPerFrame = 1000 / FPS;
        this.config = Trex.config;
        // Trạng thái hiện tại.
        this.status = Trex.status.WAITING;

        this.jumping = false;
        this.ducking = false;
        this.jumpVelocity = 0;
        this.reachedMinHeight = false;
        this.speedDrop = false;
        this.jumpCount = 0;
        this.jumpspotX = 0;

        this.init();
    };


    /**
     * Cấu hình người chơi T-rex.
     * @enum {number}
     */
    Trex.config = {
        DROP_VELOCITY: -5,
        GRAVITY: 0.6,
        HEIGHT: 47,
        HEIGHT_DUCK: 25,
        INIITAL_JUMP_VELOCITY: -10,
        INTRO_DURATION: 1500,
        MAX_JUMP_HEIGHT: 30,
        MIN_JUMP_HEIGHT: 30,
        SPEED_DROP_COEFFICIENT: 3,
        SPRITE_WIDTH: 262,
        START_X_POS: 50,
        WIDTH: 44,
        WIDTH_DUCK: 59
    };


    /**
     * Sử dụng trong phát hiện va chạm.
     * @type {Array<CollisionBox>}
     */
    Trex.collisionBoxes = {
        DUCKING: [
            new CollisionBox(1, 18, 55, 25)
        ],
        RUNNING: [
            new CollisionBox(22, 0, 17, 16),
            new CollisionBox(1, 18, 30, 9),
            new CollisionBox(10, 35, 14, 8),
            new CollisionBox(1, 24, 29, 5),
            new CollisionBox(5, 30, 21, 4),
            new CollisionBox(9, 34, 15, 4)
        ]
    };


    /**
     * Các trạng thái hoạt hình.
     * @enum {string}
     */
    Trex.status = {
        CRASHED: 'CRASHED', // Đâm phải vật cản.
        DUCKING: 'DUCKING', // Cúi xuống.
        JUMPING: 'JUMPING', // Nhảy.
        RUNNING: 'RUNNING', // Đang chạy.
        WAITING: 'WAITING'  // Đang chờ.
    };

    /**
     *  Hệ số nháy mắt.
     * @const
     */
    Trex.BLINK_TIMING = 7000;


    /**
     * Cấu hình hoạt hình cho các trạng thái khác nhau.
     * @enum {Object}
     */
    Trex.animFrames = {
        WAITING: {
            frames: [44, 0],
            msPerFrame: 1000 / 3
        },
        RUNNING: {
            frames: [88, 132],
            msPerFrame: 1000 / 12
        },
        CRASHED: {
            frames: [220],
            msPerFrame: 1000 / 60
        },
        JUMPING: {
            frames: [0],
            msPerFrame: 1000 / 60
        },
        DUCKING: {
            frames: [264, 323],
            msPerFrame: 1000 / 8
        }
    };


    Trex.prototype = {
        /**
         * Khởi tạo người chơi T-rex.
         * Thiết lập T-rex để nháy mắt với các khoảng thời gian ngẫu nhiên.
         */
        init: function () {
            this.groundYPos = Runner.defaultDimensions.HEIGHT - this.config.HEIGHT -
                Runner.config.BOTTOM_PAD;
            this.yPos = this.groundYPos;
            this.minJumpHeight = this.groundYPos - this.config.MIN_JUMP_HEIGHT;

            this.draw(0, 0);
            this.update(0, Trex.status.WAITING);
        },

        /**
         * Hàm setter cho vận tốc nhảy.
         * Vận tốc rơi tương ứng cũng sẽ được thiết lập.
         */
        setJumpVelocity: function (setting) {
            this.config.INIITAL_JUMP_VELOCITY = -setting; // Thiết lập vận tốc nhảy
            this.config.DROP_VELOCITY = -setting / 2; // Thiết lập vận tốc rơi
        },

        /**
         * Cập nhật trạng thái hoạt hình.
         * @param {!number} deltaTime - Thời gian thay đổi giữa các khung hình.
         * @param {Trex.status} status - Trạng thái tùy chọn để chuyển sang.
         */
        update: function (deltaTime, opt_status) {
            this.timer += deltaTime;

            // Cập nhật trạng thái.
            if (opt_status) {
                this.status = opt_status;
                this.currentFrame = 0;
                this.msPerFrame = Trex.animFrames[opt_status].msPerFrame;
                this.currentAnimFrames = Trex.animFrames[opt_status].frames;
                // Nếu trạng thái là WAITING, bắt đầu đếm thời gian nháy mắt
                if (opt_status == Trex.status.WAITING) {
                    this.animStartTime = getTimeStamp();
                    this.setBlinkDelay();
                }
            }

            // Hoạt hình intro game, T-rex di chuyển từ bên trái vào.
            if (this.playingIntro && this.xPos < this.config.START_X_POS) {
                this.xPos += Math.round((this.config.START_X_POS /
                    this.config.INTRO_DURATION) * deltaTime);
            }

            if (this.status == Trex.status.WAITING) {
                this.blink(getTimeStamp());
            } else {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);
            }

            // Cập nhật vị trí khung hình.
            if (this.timer >= this.msPerFrame) {
                this.currentFrame = this.currentFrame ==
                    this.currentAnimFrames.length - 1 ? 0 : this.currentFrame + 1;
                this.timer = 0;
            }

            // Tốc độ rơi trở thành hành động cúi nếu phím xuống vẫn đang được giữ.
            if (this.speedDrop && this.yPos == this.groundYPos) {
                this.speedDrop = false;
                this.setDuck(true); // Thiết lập tư thế cúi.
            }
        },

        /**
         * Vẽ T-rex tại một vị trí cụ thể.
         * @param {number} x
         * @param {number} y
         */
        draw: function (x, y) {
            var sourceX = x;
            var sourceY = y;
            var sourceWidth = this.ducking && this.status != Trex.status.CRASHED ?
                this.config.WIDTH_DUCK : this.config.WIDTH; // Điều chỉnh chiều rộng tùy theo tư thế cúi
            var sourceHeight = this.config.HEIGHT;

            if (IS_HIDPI) {
                sourceX *= 2;
                sourceY *= 2;
                sourceWidth *= 2;
                sourceHeight *= 2;  // Điều chỉnh nếu màn hình hỗ trợ độ phân giải cao (HiDPI)
            }

            // Điều chỉnh vị trí trong sprite sheet.
            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            // Nếu đang cúi.
            if (this.ducking && this.status != Trex.status.CRASHED) {
                this.canvasCtx.drawImage(Runner.imageSprite, sourceX, sourceY,
                    sourceWidth, sourceHeight,
                    this.xPos, this.yPos,
                    this.config.WIDTH_DUCK, this.config.HEIGHT);
            } else {
                // Nếu va chạm khi đang cúi. T-rex đứng lên cần điều chỉnh vị trí.
                if (this.ducking && this.status == Trex.status.CRASHED) {
                    this.xPos++;
                }
                // Tư thế đứng hoặc đang chạy.
                this.canvasCtx.drawImage(Runner.imageSprite, sourceX, sourceY,
                    sourceWidth, sourceHeight,
                    this.xPos, this.yPos,
                    this.config.WIDTH, this.config.HEIGHT);
            }
        },

        /**
         * Thiết lập một thời gian ngẫu nhiên cho việc nháy mắt.
         */
        setBlinkDelay: function () {
            this.blinkDelay = Math.ceil(Math.random() * Trex.BLINK_TIMING);
        },

        /**
         * Làm cho T-rex nháy mắt ở các khoảng thời gian ngẫu nhiên.
         * @param {number} time hời gian hiện tại tính bằng mili giây.
         */
        blink: function (time) {
            var deltaTime = time - this.animStartTime;

            if (deltaTime >= this.blinkDelay) {
                this.draw(this.currentAnimFrames[this.currentFrame], 0);

                if (this.currentFrame == 1) {
                    // Thiết lập độ trễ ngẫu nhiên mới cho việc nháy mắt.
                    this.setBlinkDelay();
                    this.animStartTime = time;
                    this.blinkCount++;
                }
            }
        },

        /**
         * Khởi tạo một cú nhảy.
         * @param {number} speed
         */
        startJump: function (speed) {
            if (!this.jumping) {
                this.update(0, Trex.status.JUMPING);
                // Điều chỉnh vận tốc nhảy dựa trên tốc độ.
                this.jumpVelocity = this.config.INIITAL_JUMP_VELOCITY - (speed / 10);
                this.jumping = true;
                this.reachedMinHeight = false; // Chưa đạt độ cao tối thiểu.
                this.speedDrop = false; // Chưa có sự tăng tốc rơi.
            }
        },

        /**
         * Nhảy hoàn tất, bắt đầu rơi xuống.
         */
        endJump: function () {
            if (this.reachedMinHeight &&
                this.jumpVelocity < this.config.DROP_VELOCITY) {
                this.jumpVelocity = this.config.DROP_VELOCITY;
            }
        },

        /**
         * Cập nhật khung hình cho một cú nhảy.
         * @param {number} deltaTime Thời gian thay đổi giữa các khung hình.
         * @param {number} speed
         */
        updateJump: function (deltaTime, speed) {
            var msPerFrame = Trex.animFrames[this.status].msPerFrame;
            var framesElapsed = deltaTime / msPerFrame;

            // Tăng tốc rơi làm T-rex rơi nhanh hơn.
            if (this.speedDrop) {
                this.yPos += Math.round(this.jumpVelocity *
                    this.config.SPEED_DROP_COEFFICIENT * framesElapsed);
            } else {
                this.yPos += Math.round(this.jumpVelocity * framesElapsed);
            }

            this.jumpVelocity += this.config.GRAVITY * framesElapsed; // Áp dụng trọng lực.

            // Đã đạt đến độ cao tối thiểu.
            if (this.yPos < this.minJumpHeight || this.speedDrop) {
                this.reachedMinHeight = true;
            }

            // Đã đạt đến độ cao tối đa.
            if (this.yPos < this.config.MAX_JUMP_HEIGHT || this.speedDrop) {
                this.endJump(); // Kết thúc cú nhảy.
            }

            // Quay lại mặt đất, cú nhảy hoàn thành.
            if (this.yPos > this.groundYPos) {
                this.reset(); // Đặt lại các tham số khi nhảy kết thúc.
                this.jumpCount++; // Tăng số lần nhảy.
            }

            this.update(deltaTime); // Cập nhật trạng thái sau khi nhảy.
        },

        /**
         * Thiết lập tăng tốc rơi. Ngay lập tức hủy bỏ cú nhảy hiện tại.
         */
        setSpeedDrop: function () {
            this.speedDrop = true; // Bật chế độ tăng tốc rơi.
            this.jumpVelocity = 1; // Thiết lập vận tốc nhảy thấp.
        },

        /**
         * @param {boolean} isDucking. Kiểm tra nếu đang cúi.
         */
        setDuck: function (isDucking) {
            if (isDucking && this.status != Trex.status.DUCKING) {
                this.update(0, Trex.status.DUCKING); // Cập nhật trạng thái cúi.
                this.ducking = true;
            } else if (this.status == Trex.status.DUCKING) {
                this.update(0, Trex.status.RUNNING); // Cập nhật trạng thái chạy.
                this.ducking = false;
            }
        },

        /**
         * Đặt lại T-rex về trạng thái chạy khi bắt đầu trò chơi.
         */
        reset: function () {
            this.yPos = this.groundYPos; // Đặt lại vị trí T-rex về mặt đất.
            this.jumpVelocity = 0; // Đặt lại vận tốc nhảy.
            this.jumping = false; // Đặt lại trạng thái nhảy.
            this.ducking = false; // Đặt lại trạng thái cúi.
            this.update(0, Trex.status.RUNNING);  // Cập nhật trạng thái chạy.
            this.midair = false; // T-rex không còn ở trên không.
            this.speedDrop = false; // Hủy bỏ tăng tốc rơi.
            this.jumpCount = 0; // Đặt lại số lần nhảy.
        }
    };


    //******************************************************************************

    /**
     * Xử lý việc hiển thị đồng hồ đo khoảng cách.
     * @param {!HTMLCanvasElement} canvas
     * @param {Object} spritePos spritePos Vị trí của hình ảnh trong sprite.
     * @param {number} canvasWidth
     * @constructor
     */
    function DistanceMeter(canvas, spritePos, canvasWidth) {
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.image = Runner.imageSprite;
        this.spritePos = spritePos;
        this.x = 0;
        this.y = 5;

        this.currentDistance = 0;
        this.maxScore = 0;
        this.highScore = 0;
        this.container = null;

        this.digits = [];
        this.acheivement = false;
        this.defaultString = '';
        this.flashTimer = 0;
        this.flashIterations = 0;
        this.invertTrigger = false;

        this.config = DistanceMeter.config;
        this.maxScoreUnits = this.config.MAX_DISTANCE_UNITS;
        this.init(canvasWidth);
    };


    /**
     * @enum {number}
     */
    DistanceMeter.dimensions = {
        WIDTH: 10,
        HEIGHT: 13,
        DEST_WIDTH: 11
    };


    /**
      * Vị trí Y của các chữ số trong bảng sprite.
      * Vị trí X luôn là 0.
     * @type {Array<number>}
     */
    DistanceMeter.yPos = [0, 13, 27, 40, 53, 67, 80, 93, 107, 120];


    /**
     * Cấu hình đồng hồ đo khoảng cách.
     * @enum {number}
     */
    DistanceMeter.config = {
        // Số lượng chữ số.
        MAX_DISTANCE_UNITS: 5,

        // Khoảng cách gây ra hoạt ảnh thành tựu.
        ACHIEVEMENT_DISTANCE: 100,

        // Dùng để chuyển đổi khoảng cách pixel sang đơn vị tỷ lệ.
        COEFFICIENT: 0.025,

        // Thời gian nhấp nháy trong mili giây.
        FLASH_DURATION: 1000 / 4,

         // Số lần nhấp nháy cho hoạt ảnh thành tựu.
        FLASH_ITERATIONS: 3
    };


    DistanceMeter.prototype = {
        /**
         * Khởi tạo đồng hồ đo khoảng cách với giá trị '00000'.
         * @param {number} width width Chiều rộng của canvas (px).
         */
        init: function (width) {
            var maxDistanceStr = '';

            this.calcXPos(width);
            this.maxScore = this.maxScoreUnits;
            for (var i = 0; i < this.maxScoreUnits; i++) {
                this.draw(i, 0);
                this.defaultString += '0';
                maxDistanceStr += '9';
            }

            this.maxScore = parseInt(maxDistanceStr);
        },

        /**
         * Tính toán vị trí x trên canvas.
         * @param {number} canvasWidth
         */
        calcXPos: function (canvasWidth) {
            this.x = canvasWidth - (DistanceMeter.dimensions.DEST_WIDTH *
                (this.maxScoreUnits + 1));
        },

        /**
         * Vẽ một chữ số lên canvas.
         * @param {number} digitPos Vị trí của chữ số.
         * @param {number} value Giá trị của chữ số từ 0 đến 9.
         * @param {boolean} opt_highScore Có vẽ điểm cao nhất hay không.
         */
        draw: function (digitPos, value, opt_highScore) {
            var sourceWidth = DistanceMeter.dimensions.WIDTH;
            var sourceHeight = DistanceMeter.dimensions.HEIGHT;
            var sourceX = DistanceMeter.dimensions.WIDTH * value;
            var sourceY = 0;

            var targetX = digitPos * DistanceMeter.dimensions.DEST_WIDTH;
            var targetY = this.y;
            var targetWidth = DistanceMeter.dimensions.WIDTH;
            var targetHeight = DistanceMeter.dimensions.HEIGHT;

            // Với độ phân giải cao, chúng ta sẽ nhân đôi giá trị của nguồn.
            if (IS_HIDPI) {
                sourceWidth *= 2;
                sourceHeight *= 2;
                sourceX *= 2;
            }

            sourceX += this.spritePos.x;
            sourceY += this.spritePos.y;

            this.canvasCtx.save();

            if (opt_highScore) {
                // Vẽ ở phía bên trái của điểm hiện tại.
                var highScoreX = this.x - (this.maxScoreUnits * 2) *
                    DistanceMeter.dimensions.WIDTH;
                this.canvasCtx.translate(highScoreX, this.y);
            } else {
                this.canvasCtx.translate(this.x, this.y);
            }

            this.canvasCtx.drawImage(this.image, sourceX, sourceY,
                sourceWidth, sourceHeight,
                targetX, targetY,
                targetWidth, targetHeight
            );

            this.canvasCtx.restore();
        },

        /**
         * Chuyển đổi khoảng cách pixel thành khoảng cách 'thực'.
         * @param {number} distance Khoảng cách tính bằng pixel.
         * @return {number} Khoảng cách 'thực' đã được chuyển đổi.
         */
        getActualDistance: function (distance) {
            return distance ? Math.round(distance * this.config.COEFFICIENT) : 0;
        },

        /**
         * Cập nhật đồng hồ đo khoảng cách.
         * @param {number} distance
         * @param {number} deltaTime
         * @return {boolean} Liệu hiệu ứng âm thanh đạt thành tích có nên được phát không.
         */
        update: function (deltaTime, distance) {
            var paint = true;
            var playSound = false;

            if (!this.acheivement) {
                distance = this.getActualDistance(distance);
                // Điểm đã vượt quá số chữ số ban đầu.
                if (distance > this.maxScore && this.maxScoreUnits ==
                    this.config.MAX_DISTANCE_UNITS) {
                    this.maxScoreUnits++;
                    this.maxScore = parseInt(this.maxScore + '9');
                } else {
                    this.distance = 0;
                }

                if (distance > 0) {
                    // Thành tích đã được mở khóa.
                    if (distance % this.config.ACHIEVEMENT_DISTANCE == 0) {
                        // Nhấp nháy điểm và phát âm thanh.
                        this.acheivement = true;
                        this.flashTimer = 0;
                        playSound = true;
                    }

                   // Tạo chuỗi đại diện cho khoảng cách với các số 0 ở đầu.
                    var distanceStr = (this.defaultString +
                        distance).substr(-this.maxScoreUnits);
                    this.digits = distanceStr.split('');
                } else {
                    this.digits = this.defaultString.split('');
                }
            } else {
                // Điều khiển nhấp nháy của điểm số khi đạt thành tích.
                if (this.flashIterations <= this.config.FLASH_ITERATIONS) {
                    this.flashTimer += deltaTime;

                    if (this.flashTimer < this.config.FLASH_DURATION) {
                        paint = false;
                    } else if (this.flashTimer >
                        this.config.FLASH_DURATION * 2) {
                        this.flashTimer = 0;
                        this.flashIterations++;
                    }
                } else {
                    this.acheivement = false;
                    this.flashIterations = 0;
                    this.flashTimer = 0;
                }
            }

            // Vẽ các chữ số nếu không có hiệu ứng nhấp nháy.
            if (paint) {
                for (var i = this.digits.length - 1; i >= 0; i--) {
                    this.draw(i, parseInt(this.digits[i]));
                }
            }

            this.drawHighScore();
            return playSound;
        },

        /**
         * Vẽ điểm số cao nhất.
         */
        drawHighScore: function () {
            this.canvasCtx.save();
            this.canvasCtx.globalAlpha = .8;
            for (var i = this.highScore.length - 1; i >= 0; i--) {
                this.draw(i, parseInt(this.highScore[i], 10), true);
            }
            this.canvasCtx.restore();
        },

        /**
         * Đặt điểm số cao nhất dưới dạng chuỗi mảng.
         * Vị trí của ký tự trong sprite: H - 10, I - 11.
         * @param {number} distance Khoảng cách đã chạy tính bằng pixel.
         */
        setHighScore: function (distance) {
            distance = this.getActualDistance(distance);
            var highScoreStr = (this.defaultString +
                distance).substr(-this.maxScoreUnits);

            this.highScore = ['10', '11', ''].concat(highScoreStr.split(''));
        },

        /**
         * Đặt lại đồng hồ đo khoảng cách về '00000'.
         */
        reset: function () {
            this.update(0);
            this.acheivement = false;
        }
    };


    //******************************************************************************

    /**
     * Đối tượng mây nền.
     * Giống như đối tượng chướng ngại vật nhưng không có hộp va chạm.
     * @param {HTMLCanvasElement} canvas Phần tử canvas
     * @param {Object} spritePos Vị trí của hình ảnh trong sprite.
     * @param {number} containerWidth Chiều rộng của container
     */
    function Cloud(canvas, spritePos, containerWidth) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.spritePos = spritePos;
        this.containerWidth = containerWidth;
        this.xPos = containerWidth;
        this.yPos = 0;
        this.remove = false;
        this.cloudGap = getRandomNum(Cloud.config.MIN_CLOUD_GAP,
            Cloud.config.MAX_CLOUD_GAP);

        this.init();
    };


    /**
     * Cấu hình đối tượng mây.
     * @enum {number}
     */
    Cloud.config = {
        HEIGHT: 14,
        MAX_CLOUD_GAP: 400,
        MAX_SKY_LEVEL: 30,
        MIN_CLOUD_GAP: 100,
        MIN_SKY_LEVEL: 71,
        WIDTH: 46
    };


    Cloud.prototype = {
        /**
         *  Khởi tạo mây. Đặt chiều cao của mây.
         */
        init: function () {
            this.yPos = getRandomNum(Cloud.config.MAX_SKY_LEVEL,
                Cloud.config.MIN_SKY_LEVEL);
            this.draw();
        },

        /**
         *  Vẽ mây.
         */
        draw: function () {
            this.canvasCtx.save();
            var sourceWidth = Cloud.config.WIDTH;
            var sourceHeight = Cloud.config.HEIGHT;

            if (IS_HIDPI) {
                sourceWidth = sourceWidth * 2;
                sourceHeight = sourceHeight * 2;
            }

            this.canvasCtx.drawImage(Runner.imageSprite, this.spritePos.x,
                this.spritePos.y,
                sourceWidth, sourceHeight,
                this.xPos, this.yPos,
                Cloud.config.WIDTH, Cloud.config.HEIGHT);

            this.canvasCtx.restore();
        },

        /**
         * Cập nhật vị trí của mây..
         * @param {number} speed Tốc độ di chuyển của mây
         */
        update: function (speed) {
            if (!this.remove) {
                this.xPos -= Math.ceil(speed);
                this.draw();

                // Đánh dấu để xóa nếu mây không còn trên canvas.
                if (!this.isVisible()) {
                    this.remove = true;
                }
            }
        },

        /**
         * Kiểm tra xem mây có đang hiển thị trên sân khấu không.
         * @return {boolean}
         */
        isVisible: function () {
            return this.xPos + Cloud.config.WIDTH > 0;
        }
    };


    //******************************************************************************

    /**
     * Chế độ ban đêm hiển thị mặt trăng và các vì sao trên đường chân trời.
     */
    function NightMode(canvas, spritePos, containerWidth) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.xPos = containerWidth - 50;
        this.yPos = 30;
        this.currentPhase = 0;
        this.opacity = 0;
        this.containerWidth = containerWidth;
        this.stars = [];
        this.drawStars = false;
        this.placeStars();
    };

    /**
     * Cấu hình đối tượng Chế độ ban đêm.
     * @enum {number}
     */
    NightMode.config = {
        FADE_SPEED: 0.035, // Tốc độ mờ dần
        HEIGHT: 40, // Chiều cao của mặt trăng
        MOON_SPEED: 0.25, // Tốc độ di chuyển của mặt trăng
        NUM_STARS: 2, // Số lượng sao
        STAR_SIZE: 9, // Kích thước sao
        STAR_SPEED: 0.3, // Tốc độ di chuyển của sao
        STAR_MAX_Y: 70, // Giới hạn Y tối đa của sao
        WIDTH: 20  // Chiều rộng của mặt trăng
    };

    NightMode.phases = [140, 120, 100, 60, 40, 20, 0]; // Các pha của mặt trăng

    NightMode.prototype = {
        /**
         * Cập nhật mặt trăng di chuyển, thay đổi các pha.
         * @param {boolean} activated activated Chế độ ban đêm có được kích hoạt không.
         * @param {number} delta
         */
        update: function (activated, delta) {
            // Pha của mặt trăng.
            if (activated && this.opacity == 0) {
                this.currentPhase++;

                if (this.currentPhase >= NightMode.phases.length) {
                    this.currentPhase = 0;
                }
            }

            // Mờ dần vào / ra.
            if (activated && (this.opacity < 1 || this.opacity == 0)) {
                this.opacity += NightMode.config.FADE_SPEED;
            } else if (this.opacity > 0) {
                this.opacity -= NightMode.config.FADE_SPEED;
            }

            // Đặt vị trí của mặt trăng.
            if (this.opacity > 0) {
                this.xPos = this.updateXPos(this.xPos, NightMode.config.MOON_SPEED);

                // Cập nhật các ngôi sao.
                if (this.drawStars) {
                    for (var i = 0; i < NightMode.config.NUM_STARS; i++) {
                        this.stars[i].x = this.updateXPos(this.stars[i].x,
                            NightMode.config.STAR_SPEED);
                    }
                }
                this.draw();
            } else {
                this.opacity = 0;
                this.placeStars();
            }
            this.drawStars = true;
        },

        updateXPos: function (currentPos, speed) {
            if (currentPos < -NightMode.config.WIDTH) {
                currentPos = this.containerWidth; // Nếu vị trí hiện tại nhỏ hơn chiều rộng của chế độ ban đêm, đặt lại vị trí thành chiều rộng của container
            } else {
                currentPos -= speed; // Giảm vị trí hiện tại theo tốc độ di chuyển
            }
            return currentPos; // Trả về vị trí cập nhật
        },

        draw: function () {
            var moonSourceWidth = this.currentPhase == 3 ? NightMode.config.WIDTH * 2 :
                NightMode.config.WIDTH; // Chiều rộng của mặt trăng tùy thuộc vào giai đoạn hiện tại
            var moonSourceHeight = NightMode.config.HEIGHT; // Chiều cao của mặt trăng
            var moonSourceX = this.spritePos.x + NightMode.phases[this.currentPhase]; // Tọa độ x của mặt trăng từ sprite
            var moonOutputWidth = moonSourceWidth; // Chiều rộng của mặt trăng sẽ vẽ ra
            var starSize = NightMode.config.STAR_SIZE; // Kích thước của ngôi sao
            var starSourceX = Runner.spriteDefinition.LDPI.STAR.x; // Tọa độ x của ngôi sao từ sprite (LDPI)

            if (IS_HIDPI) {
                moonSourceWidth *= 2;  // Tăng chiều rộng mặt trăng nếu đang sử dụng HiDPI
                moonSourceHeight *= 2;  // Tăng chiều cao mặt trăng nếu đang sử dụng HiDPI
                moonSourceX = this.spritePos.x +  
                    (NightMode.phases[this.currentPhase] * 2); // Điều chỉnh tọa độ x của mặt trăng cho HiDPI
                starSize *= 2;
                starSourceX = Runner.spriteDefinition.HDPI.STAR.x; // Tọa độ x của ngôi sao từ sprite (HDPI)
            }

            this.canvasCtx.save(); // Lưu trạng thái của bối cảnh vẽ
            this.canvasCtx.globalAlpha = this.opacity;

            // Ngôi sao.
            if (this.drawStars) {
                for (var i = 0; i < NightMode.config.NUM_STARS; i++) {
                    this.canvasCtx.drawImage(Runner.imageSprite,
                        starSourceX, this.stars[i].sourceY, starSize, starSize, // Vẽ ngôi sao từ sprite
                        Math.round(this.stars[i].x), this.stars[i].y, // Vị trí của ngôi sao
                        NightMode.config.STAR_SIZE, NightMode.config.STAR_SIZE); // Kích thước ngôi sao
                }
            }

            // Mặt trăng.
            this.canvasCtx.drawImage(Runner.imageSprite, moonSourceX,
                this.spritePos.y, moonSourceWidth, moonSourceHeight,  // Vẽ mặt trăng từ sprite
                Math.round(this.xPos), this.yPos, // Vị trí mặt trăng
                moonOutputWidth, NightMode.config.HEIGHT); // Kích thước mặt trăng

            this.canvasCtx.globalAlpha = 1;
            this.canvasCtx.restore();
        },

        // Đặt các ngôi sao.
        placeStars: function () {
            var segmentSize = Math.round(this.containerWidth /
                NightMode.config.NUM_STARS); // Chia đều không gian cho các ngôi sao

            for (var i = 0; i < NightMode.config.NUM_STARS; i++) {
                this.stars[i] = {}; // Khởi tạo mảng các ngôi sao
                this.stars[i].x = getRandomNum(segmentSize * i, segmentSize * (i + 1)); // Vị trí x ngẫu nhiên cho ngôi sao
                this.stars[i].y = getRandomNum(0, NightMode.config.STAR_MAX_Y); // Vị trí y ngẫu nhiên cho ngôi sao

                if (IS_HIDPI) {
                    this.stars[i].sourceY = Runner.spriteDefinition.HDPI.STAR.y +
                        NightMode.config.STAR_SIZE * 2 * i; // Tọa độ y của ngôi sao trong chế độ HiDPI
                } else {
                    this.stars[i].sourceY = Runner.spriteDefinition.LDPI.STAR.y +
                        NightMode.config.STAR_SIZE * i; // Tọa độ y của ngôi sao trong chế độ LDPI
                }
            }
        },

        reset: function () {
            this.currentPhase = 0; // Đặt lại giai đoạn mặt trăng về 0
            this.opacity = 0; // Đặt lại độ mờ về 0
            this.update(false); // Cập nhật lại chế độ ban đêm (tắt chế độ)
        }

    };


    //******************************************************************************

    /**
     * Đoạn đường chân trời.
     * Gồm hai đoạn đường nối với nhau. Ngẫu nhiên gán một đường chân trời phẳng hoặc gập ghềnh.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos Horizon Vị trí của đường chân trời trong sprite.
     * @constructor
     */
    function HorizonLine(canvas, spritePos) {
        this.spritePos = spritePos;
        this.canvas = canvas;
        this.canvasCtx = canvas.getContext('2d');
        this.sourceDimensions = {};
        this.dimensions = HorizonLine.dimensions;
        this.sourceXPos = [this.spritePos.x, this.spritePos.x +
            this.dimensions.WIDTH];
        this.xPos = [];
        this.yPos = 0;
        this.bumpThreshold = 0.5;

        this.setSourceDimensions();
        this.draw();
    };


    /**
     * Kích thước của đường chân trời.
     * @enum {number}
     */
    HorizonLine.dimensions = {
        WIDTH: 600,
        HEIGHT: 12,
        YPOS: 127
    };


    HorizonLine.prototype = {
        /**
         * Cài đặt các kích thước nguồn của đường chân trời.
         */
        setSourceDimensions: function () {

            for (var dimension in HorizonLine.dimensions) {
                if (IS_HIDPI) {
                    if (dimension != 'YPOS') {
                        this.sourceDimensions[dimension] =
                            HorizonLine.dimensions[dimension] * 2;
                    }
                } else {
                    this.sourceDimensions[dimension] =
                        HorizonLine.dimensions[dimension];
                }
                this.dimensions[dimension] = HorizonLine.dimensions[dimension];
            }

            this.xPos = [0, HorizonLine.dimensions.WIDTH];
            this.yPos = HorizonLine.dimensions.YPOS;
        },

        /**
         * Trả về vị trí cắt x của một loại đường chân trời.
         */
        getRandomType: function () {
            return Math.random() > this.bumpThreshold ? this.dimensions.WIDTH : 0;
        },

        /**
         *  Vẽ đường chân trời.
         */
        draw: function () {
            this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[0],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[0], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);

            this.canvasCtx.drawImage(Runner.imageSprite, this.sourceXPos[1],
                this.spritePos.y,
                this.sourceDimensions.WIDTH, this.sourceDimensions.HEIGHT,
                this.xPos[1], this.yPos,
                this.dimensions.WIDTH, this.dimensions.HEIGHT);
        },

        /**
         * Cập nhật vị trí x của từng đoạn đường.
         * @param {number} pos Vị trí của đường.
         * @param {number} increment
         */
        updateXPos: function (pos, increment) {
            var line1 = pos;
            var line2 = pos == 0 ? 1 : 0;

            this.xPos[line1] -= increment;
            this.xPos[line2] = this.xPos[line1] + this.dimensions.WIDTH;

            if (this.xPos[line1] <= -this.dimensions.WIDTH) {
                this.xPos[line1] += this.dimensions.WIDTH * 2;
                this.xPos[line2] = this.xPos[line1] - this.dimensions.WIDTH;
                this.sourceXPos[line1] = this.getRandomType() + this.spritePos.x;
            }
        },

        /**
         * Cập nhật đường chân trời.
         * @param {number} deltaTime
         * @param {number} speed
         */
        update: function (deltaTime, speed) {
            var increment = Math.floor(speed * (FPS / 1000) * deltaTime);

            if (this.xPos[0] <= 0) {
                this.updateXPos(0, increment);
            } else {
                this.updateXPos(1, increment);
            }
            this.draw();
        },

        /**
         * Đặt lại đường chân trời về vị trí ban đầu.
         */
        reset: function () {
            this.xPos[0] = 0;
            this.xPos[1] = HorizonLine.dimensions.WIDTH;
        }
    };


    //******************************************************************************

    /**
     * Lớp nền chân trời.
     * @param {HTMLCanvasElement} canvas
     * @param {Object} spritePos Vị trí của sprite.
     * @param {Object} dimensions Kích thước của canvas
     * @param {number} gapCoefficient
     * @constructor
     */
    function Horizon(canvas, spritePos, dimensions, gapCoefficient) {
        this.canvas = canvas;
        this.canvasCtx = this.canvas.getContext('2d');
        this.config = Horizon.config;
        this.dimensions = dimensions;
        this.gapCoefficient = gapCoefficient;
        this.obstacles = [];
        this.obstacleHistory = [];
        this.horizonOffsets = [0, 0];
        this.cloudFrequency = this.config.CLOUD_FREQUENCY;
        this.spritePos = spritePos;
        this.nightMode = null;

        // Cloud
        this.clouds = [];
        this.cloudSpeed = this.config.BG_CLOUD_SPEED;

        // Chân trời
        this.horizonLine = null;
        this.init();
    };


    /**
     * Cấu hình của chân trời.
     * @enum {number}
     */
    Horizon.config = {
        BG_CLOUD_SPEED: 0.2, // Tốc độ mây nền
        BUMPY_THRESHOLD: .3, // Ngưỡng độ gập ghềnh
        CLOUD_FREQUENCY: .5, // Tần suất mây xuất hiện
        HORIZON_HEIGHT: 16,  // Chiều cao của chân trời 
        MAX_CLOUDS: 6 // Số lượng mây tối đa
    };


    Horizon.prototype = {
        /**
         * Khởi tạo chân trời. Chỉ thêm đường chân trời và một đám mây. Không có chướng ngại vật.
         */
        init: function () {
            this.addCloud();
            this.horizonLine = new HorizonLine(this.canvas, this.spritePos.HORIZON);
            this.nightMode = new NightMode(this.canvas, this.spritePos.MOON,
                this.dimensions.WIDTH);
        },

        /**
         * @param {number} deltaTime
         * @param {number} currentSpeed
         * @param {boolean} updateObstacles Dùng làm một cơ chế ghi đè để ngừng cập nhật/ thêm chướng ngại vật. Điều này xảy ra trong phần chuyển động dễ dàng
         * @param {boolean} showNightMode Chế độ ban đêm có được kích hoạt hay không.
         */
        update: function (deltaTime, currentSpeed, updateObstacles, showNightMode) {
            this.runningTime += deltaTime;
            this.horizonLine.update(deltaTime, currentSpeed);
            this.nightMode.update(showNightMode);
            this.updateClouds(deltaTime, currentSpeed);

            if (updateObstacles) {
                this.updateObstacles(deltaTime, currentSpeed);
            }
        },

        /**
         * Cập nhật vị trí các đám mây.
         * @param {number} deltaTime
         * @param {number} currentSpeed
         */
        updateClouds: function (deltaTime, speed) {
            var cloudSpeed = this.cloudSpeed / 1000 * deltaTime * speed;
            var numClouds = this.clouds.length;

            if (numClouds) {
                for (var i = numClouds - 1; i >= 0; i--) {
                    this.clouds[i].update(cloudSpeed);
                }

                var lastCloud = this.clouds[numClouds - 1];

                // Kiểm tra để thêm một đám mây mới.
                if (numClouds < this.config.MAX_CLOUDS &&
                    (this.dimensions.WIDTH - lastCloud.xPos) > lastCloud.cloudGap &&
                    this.cloudFrequency > Math.random()) {
                    this.addCloud();
                }

                // Xóa các đám mây đã hết hạn.
                this.clouds = this.clouds.filter(function (obj) {
                    return !obj.remove;
                });
            } else {
                this.addCloud();
            }
        },

        /**
         * Cập nhật vị trí các chướng ngại vật.
         * @param {number} deltaTime
         * @param {number} currentSpeed
         */
        updateObstacles: function (deltaTime, currentSpeed) {
            // Chướng ngại vật, chuyển sang lớp chân trời.
            var updatedObstacles = this.obstacles.slice(0);

            for (var i = 0; i < this.obstacles.length; i++) {
                var obstacle = this.obstacles[i];
                obstacle.update(deltaTime, currentSpeed);

                // Dọn dẹp chướng ngại vật đã xóa.
                if (obstacle.remove) {
                    updatedObstacles.shift();
                }
            }
            this.obstacles = updatedObstacles;

            if (this.obstacles.length > 0) {
                var lastObstacle = this.obstacles[this.obstacles.length - 1];

                if (lastObstacle && !lastObstacle.followingObstacleCreated &&
                    lastObstacle.isVisible() &&
                    (lastObstacle.xPos + lastObstacle.width + lastObstacle.gap) <
                    this.dimensions.WIDTH) {
                    this.addNewObstacle(currentSpeed);
                    lastObstacle.followingObstacleCreated = true;
                }
            } else {
                // Tạo các chướng ngại vật mới.
                this.addNewObstacle(currentSpeed);
            }
        },

        removeFirstObstacle: function () {
            this.obstacles.shift();
        },

        /**
         * Thêm một chướng ngại vật mới.
         * @param {number} currentSpeed
         */
        addNewObstacle: function (currentSpeed) {
            var obstacleTypeIndex = getRandomNum(0, Obstacle.types.length - 1);
            var obstacleType = Obstacle.types[obstacleTypeIndex];

            // Kiểm tra sự xuất hiện nhiều lần của cùng một loại chướng ngại vật.
            // Đồng thời kiểm tra xem chướng ngại vật có thể xuất hiện ở tốc độ hiện tại hay không.
            if (this.duplicateObstacleCheck(obstacleType.type) ||
                currentSpeed < obstacleType.minSpeed) {
                this.addNewObstacle(currentSpeed);
            } else {
                var obstacleSpritePos = this.spritePos[obstacleType.type];

                this.obstacles.push(new Obstacle(this.canvasCtx, obstacleType,
                    obstacleSpritePos, this.dimensions,
                    this.gapCoefficient, currentSpeed, obstacleType.width));

                this.obstacleHistory.unshift(obstacleType.type);

                if (this.obstacleHistory.length > 1) {
                    this.obstacleHistory.splice(Runner.config.MAX_OBSTACLE_DUPLICATION);
                }
            }
        },

        /**
        * Kiểm tra xem hai chướng ngại vật trước có giống với chướng ngại vật tiếp theo không.
        * Số lần trùng lặp tối đa được thiết lập trong giá trị cấu hình MAX_OBSTACLE_DUPLICATION.
        * @return {boolean}
        */
        duplicateObstacleCheck: function (nextObstacleType) {
            var duplicateCount = 0;

            for (var i = 0; i < this.obstacleHistory.length; i++) {
                duplicateCount = this.obstacleHistory[i] == nextObstacleType ?
                    duplicateCount + 1 : 0;
            }
            return duplicateCount >= Runner.config.MAX_OBSTACLE_DUPLICATION;
        },

       /**
        * Đặt lại lớp chân trời.
        * Loại bỏ các chướng ngại vật hiện có và di chuyển lại đường chân trời.
        */
        reset: function () {
            this.obstacles = [];
            this.horizonLine.reset();
            this.nightMode.reset();
        },

        /**
        * Cập nhật chiều rộng và tỷ lệ của canvas.
        * @param {number} width Chiều rộng của canvas.
        * @param {number} height Chiều cao của canvas.
        */
        resize: function (width, height) {
            this.canvas.width = width;
            this.canvas.height = height;
        },
        /**
        *Thêm một đám mây mới vào chân trời.
        */
        addCloud: function () {
            this.clouds.push(new Cloud(this.canvas, this.spritePos.CLOUD,
                this.dimensions.WIDTH));
        }
    };
})();

function onDocumentLoad() {
    new Runner('.interstitial-wrapper');
}

document.addEventListener('DOMContentLoaded', onDocumentLoad);