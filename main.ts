//% color="#00CC00" icon="\uf1f9"
//% block="XGO Rider"
//% block.loc.nl="XGO Rider"
namespace CXgoRider {

    let headData = 0x5500
    let tailData = 0x00AA
    let headDataH = (headData >> 8) & 0xff;
    let headDataL = (headData >> 0) & 0xff;
    let tailDataH = (tailData >> 8) & 0xff;
    let tailDataL = (tailData >> 0) & 0xff;

    function writeCommand(len: number, addr: number, data: number) {
        let commands_buffer = pins.createBuffer(len)
        commands_buffer[0] = headDataH
        commands_buffer[1] = headDataL
        commands_buffer[2] = len
        commands_buffer[3] = 0x00
        commands_buffer[4] = addr
        commands_buffer[5] = data
        commands_buffer[6] = ~(len + 0x00 + addr + data)
        commands_buffer[7] = tailDataH
        commands_buffer[8] = tailDataL
        serial.writeBuffer(commands_buffer)
    }

    function readCommand(len: number, addr: number, readlen: number) {
        let commands_buffer = pins.createBuffer(len)
        commands_buffer[0] = headDataH
        commands_buffer[1] = headDataL
        commands_buffer[2] = len
        commands_buffer[3] = 0x02
        commands_buffer[4] = addr
        commands_buffer[5] = readlen
        commands_buffer[6] = ~(len + 0x02 + addr + readlen)
        commands_buffer[7] = tailDataH
        commands_buffer[8] = tailDataL
        serial.writeBuffer(commands_buffer)
        let read_data_buffer = pins.createBuffer(9)
        read_data_buffer = serial.readBuffer(9)
        return read_data_buffer[5]
    }

    function actionMode() {
        let status = readCommand(0x09, 0x02, 0x01)
        if (status == 0x00) return;
        writeCommand(0x09, 0x3E, 0xFF)
        basic.pause(1000)
    }

    function performanceMode() {
        writeCommand(0x09, 0x03, 0x00)
        basic.pause(1000)
    }

    serial.redirect(SerialPin.P14, SerialPin.P13, BaudRate.BaudRate115200)
    actionMode()

    enum Direction {
        Forward,
        Backward,
        Clockwise,
        CounterClockwise
    }

    function batteryStatus(): number {
        return readCommand(0x09, 0x01, 0x01)
    }

    function setHeight(height: number) {
        let data = Math.map(height, -20, 20, 0, 255)
        writeCommand(0x09, 0x35, data)
        basic.pause(100)
    }

    function setAngle(angle: number) {
        let data = Math.map(angle, -100, 100, 0, 255)
        writeCommand(0x09, 0x36, data)
        basic.pause(100)
    }

    function moveRider(direct: Direction, speed: number) {
        if (direct == Direction.Forward)
            speed = -speed
        let data = Math.map(speed, -100, 100, 0, 255)
        writeCommand(0x09, 0x30, data)
        basic.pause(100)
    }

    function rotateRider(direct: Direction, speed: number) {
        if (direct == Direction.Clockwise)
            speed = -speed
        let data = Math.map(speed, -100, 100, 0, 255)
        writeCommand(0x09, 0x32, data)
    }

    function squattingFunc(time: number) {
        time = 4 - time
        let data = Math.map(time, 0, 2, 1, 255)
        writeCommand(0x09, 0x82, data)
    }

    function shufflingFunc(time: number) {
        time = 4 - time
        let data = Math.map(time, 0, 2, 1, 255)
        writeCommand(0x09, 0x39, data)
    }

    //////////////
    // MESSAGES //
    //////////////

    // The XGo is programmed by means of messages.
    // The available messages are enumerated in 'Message'
    // and are executed by the routine 'handleMessage'.

    enum Message {

        Stop,           // stops the walking
        Wait,           // suspend the program for the specified time

        FastWave,       // execute next message in a wave
        NormalWave,
        SlowWave,

        Action,         // perform a standard action

        Forward,        // move in the specified direction
        Backward,
        Left,
        Right,

        SetSpeed,       // set the speed between 0 and 100 %
        SpeedUp,        // speeding up by 10 %
        SlowDown,       // slowing down by 10 %

        TurnLeft,       // turn as a continuous rotation
        TurnRight,      // the rotation will be stopped by
        TurnOff,        // a movement message or the stop message

        Stretch,        // stretch or shrink the body
        Angle,          // angle of the wheels to the floor

        Pee             // standard action
    }

    let MESSAGE: number = -1
    let PAUSE: boolean = false

    //////////////////////////////
    // SEVERAL XGO'S IN A GROUP //
    //////////////////////////////

    // In a group a rider should call:
    // - setGroup, specifying the group it is committed to.
    // - setPosition, specifying the position within the group.
    // The position in the group determines the waiting time
    // when an instruction must be performed in 'wave'-mode.

    export enum Position {
        //% block="position 1"
        //% block.loc.nl="positie 1"
        Position1,
        //% block="position 2"
        //% block.loc.nl="positie 2"
        Position2,
        //% block="position 3"
        //% block.loc.nl="positie 3"
        Position3,
        //% block="position 4"
        //% block.loc.nl="positie 4"
        Position4,
        //% block="position 5"
        //% block.loc.nl="positie 5"
        Position5,
        //% block="position 6"
        //% block.loc.nl="positie 6"
        Position6,
        //% block="position 7"
        //% block.loc.nl="positie 7"
        Position7,
        //% block="position 8"
        //% block.loc.nl="positie 8"
        Position8,
        //% block="position 9"
        //% block.loc.nl="positie 9"
        Position9
    }

    export enum Wave {
        //% block="slow"
        //% block.loc.nl="langzame"
        Slow,
        //% block="normal"
        //% block.loc.nl="gewone"
        Normal,
        //% block="fast"
        //% block.loc.nl="snelle"
        Fast
    }

    let POSITION: number = 0 // leader
    let WAVE: number = 0

    /////////////////////////
    // CONTROLLING THE XGO //
    /////////////////////////

    export enum Movement {
        //% block="forward""
        //% block.loc.nl="vooruit"
        Forward,
        //% block="backward"
        //% block.loc.nl="achteruit"
        Backward
    }

    export enum Rotation {
        //% block="to the left"
        //% block.loc.nl="naar links"
        TurnLeft,
        //% block="to the right"
        //% block.loc.nl="naar rechts"
        TurnRight,
        //% block="30 deg to the left"
        //% block.loc.nl="30 gr naar links"
        RotateLeft,
        //% block="30 deg to the right"
        //% block.loc.nl="30 gr naar rechts"
        RotateRight
    }

    let MOVEMENT: number = Message.Stop // the latest movement message

    // Speed range:
    // ------------
    // Value: 0 to 100 (in %)
    // Message: 1000 to 1100
    let SPEED: number = 50

    // Stretch range:
    // --------------
    // Value: -20 to 20 (in mm)
    // Message: 500 to 540
    let STRETCH: number = 0

    // Angle range:
    // --------------
    // Value: -100 to 100 (in degr)
    // Message: 700 to 800
    let ANGLE: number = 0

    export enum Action {
        //% block="pee"
        //% block.loc.nl="plassen"
        Pee
    }

    ///////////////////////////////
    // MESSAGE HANDLING ROUTINES //
    ///////////////////////////////

    function stopMoving() {
        let data = Math.map(0, -100, 100, 0, 255)
        writeCommand(0x09, 0x30, data)  // move forward/backward
        writeCommand(0x09, 0x32, data)  // turn left/right
    }

    function handleMessage() {

        // Instead of 'Message.Wait', this message is submitted by
        // the calculated value of '10000 + wait time'.
        let wait = 0
        if (MESSAGE >= 10000) {
            wait = MESSAGE - 10000
            MESSAGE = Message.Wait
        }

        // Instead of 'Message.Speed', this message is submitted by
        // the calculated value of '1000 + required speed'.
        if (MESSAGE >= 1000) {
            SPEED = MESSAGE - 1000
            // reactivate the latest movement message
            MESSAGE = MOVEMENT
        }

        // Instead of 'Message.Angle', this message is submitted by
        // the calculated value of '600 + required angle'.
        if (MESSAGE >= 600) {
            ANGLE = MESSAGE - 700
            // reactivate the latest movement message
            MESSAGE = Message.Angle
        }

        // Instead of 'Message.Stretch', this message is submitted by
        // the calculated value of '500 + required height'.
        if (MESSAGE >= 500) {
            STRETCH = MESSAGE - 520
            // reactivate the latest movement message
            MESSAGE = Message.Stretch
        }

        // The messages 'Message.FastWave', 'Message.NormalWave'
        // and 'Message.SlowWave' only set the WAVE variable
        // depending on the follower's position.
        // Afterwards, WAVE is used to pause before the
        // execution of the next message to create the wave effect.
        // Message.Stop however is excluded from the wave behaviour.
        if (WAVE > 0 && MESSAGE != Message.Stop) {
            basic.pause(WAVE * 1000)
            WAVE = 0
        }

        switch (MESSAGE) {
            case Message.Stop:
                stopMoving()
                break
            case Message.Wait:
                basic.pause(wait * 1000)
                break
            case Message.FastWave:
                WAVE = (POSITION - 1) * 0.3
                break
            case Message.NormalWave:
                WAVE = (POSITION - 1) * 0.5
                break
            case Message.SlowWave:
                WAVE = (POSITION - 1) * 1.0
                break
            //
            // XGO MOVEMENT CONTROL
            //
            case Message.Forward:
                MOVEMENT = Message.Forward
                rotateRider(Direction.Clockwise, 0)
                moveRider(Direction.Forward, SPEED)
                break
            case Message.Backward:
                MOVEMENT = Message.Backward
                rotateRider(Direction.Clockwise, 0)
                moveRider(Direction.Backward, SPEED)
                break
            case Message.TurnLeft:
                MOVEMENT = Message.Left
                moveRider(Direction.Forward, 0)
                rotateRider(Direction.CounterClockwise, SPEED)
                break
            case Message.TurnRight:
                MOVEMENT = Message.Right
                moveRider(Direction.Forward, 0)
                rotateRider(Direction.Clockwise, SPEED)
                break
            case Message.TurnOff:
                MOVEMENT = Message.TurnOff
                rotateRider(Direction.Clockwise, 0)
                break
            case Message.SpeedUp:
                SPEED += 10
                if (SPEED > 100) SPEED = 100
                // call handleMessage recursively to activate the speed
                MESSAGE = MOVEMENT
                handleMessage()
                break
            case Message.SlowDown:
                SPEED -= 10
                if (SPEED < 0) SPEED = 0
                // call handleMessage recursively to activate the speed
                MESSAGE = MOVEMENT
                handleMessage()
                break
            case Message.Stretch:
                setHeight(STRETCH)
                break
            case Message.Angle:
                setAngle(ANGLE)
                break
            //
            // XGO STANDARD ACTIONS
            //
            case Message.Pee:
                break
        }
        MESSAGE = -1
    }

    function showPosition(): void {
        basic.showString("P" + POSITION.toString())
    }

    input.onLogoEvent(TouchButtonEvent.Pressed, function () {
        showPosition()
    })

    ////////////////////////
    // PROGRAMMING BLOCKS //
    ////////////////////////

    //% subcategory.loc.en="Wave"
    //% subcategory.loc.nl="Wave"
    //% block="position"
    //% block.loc.nl="positie"
    export function position(): number {
        return POSITION
    }

    //% subcategory.loc.en="Wave"
    //% subcategory.loc.nl="Wave"
    //% block="follow at %pos"
    //% block.loc.nl="volg op %pos"
    export function setPosition(pos: Position) {
        POSITION = pos + 1
    }

    //% subcategory.loc.en="Wave"
    //% subcategory.loc.nl="Wave"
    //% block="position %player"
    //% block.loc.nl="positie %player"
    export function isPosition(): number {
        return POSITION
    }

    //% subcategory.loc.en="Wave"
    //% subcategory.loc.nl="Wave"
    //% block="do a %wave wave"
    //% block.loc.nl="maak een %wave wave"
    export function setWave(wave: Wave) {
        switch (wave) {
            case Wave.Slow: MESSAGE = Message.SlowWave; break;
            case Wave.Normal: MESSAGE = Message.NormalWave; break;
            case Wave.Fast: MESSAGE = Message.FastWave; break;
        }
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Motion"
    //% subcategory.loc.nl="Beweging"
    //% block="perform the %action"
    //% block.loc.nl="ga %action"
    export function performAction(action: Action) {
        switch (action) {
            case Action.Pee: MESSAGE = Message.Pee; break;
        }
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Motion"
    //% subcategory.loc.nl="Beweging"
    //% block="stretch %height mm"
    //% block.loc.nl="strek %height mm"
    //% height.min=0 height.max=20 height.defl=0
    export function stretch(height: number) {
        MESSAGE = 520 + height
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Motion"
    //% subcategory.loc.nl="Beweging"
    //% block="shrink %height mm"
    //% block.loc.nl="krimp %height mm"
    //% height.min=0 height.max=20 height.defl=0
    export function shrink(height: number) {
        MESSAGE = 520 - height
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Motion"
    //% subcategory.loc.nl="Beweging"
    //% block="lean %angle ° to the left"
    //% block.loc.nl="hel %angle ° over naar links"
    //% angle.min=0 angle.max=45 angle.defl=0
    export function leanLeft(angle: number) {
        MESSAGE = 700 + 2*angle
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Motion"
    //% subcategory.loc.nl="Beweging"
    //% block="lean %angle ° to the right"
    //% block.loc.nl="hel %angle ° over naar rechts"
    //% angle.min=0 angle.max=45 angle.defl=0
    export function leanRight(angle: number) {
        MESSAGE = 700 - 2*angle
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Ride"
    //% subcategory.loc.nl="Rijden"
    //% block="turn %rotation"
    //% block.loc.nl="draai %rotation"
    export function turn(rotation: Rotation) {
        switch (rotation) {
            case Rotation.TurnLeft: MESSAGE = Message.TurnLeft; break;
            case Rotation.TurnRight: MESSAGE = Message.TurnRight; break;
        }
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Ride"
    //% subcategory.loc.nl="Rijden"
    //% block="ride %movement"
    //% block.loc.nl="rijd %movement"
    export function move(movement: Movement) {
        switch (movement) {
            case Movement.Forward: MESSAGE = Message.Forward; break;
            case Movement.Backward: MESSAGE = Message.Backward; break;
        }
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Ride"
    //% subcategory.loc.nl="Rijden"
    //% block="set speed to %speed \\%"
    //% block.loc.nl="stel de snelheid in op %speed \\%"
    //% speed.min=0 speed.max=100 speed.defl=50
    export function setSpeed(speed: number) {
        MESSAGE = 1000 + speed;
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="Ride"
    //% subcategory.loc.nl="Rijden"
    //% block="stop"
    //% block.loc.nl="stop"
    export function stop() {
        MESSAGE = Message.Stop
        if (!PAUSE) handleMessage()
    }

    //% subcategory.loc.en="General"
    //% subcategory.loc.nl="Algemeen"
    //% block="a number from %min upto %max"
    //% block.loc.nl="een getal van %min t/m %max"
    //% max.defl=10
    export function randomInt(min: number, max: number): number {
        let i = 0
        if (min > max) {
            i = min
            min = max
            max = i
        }
        i = max - min + 1
        i = min + Math.floor(Math.random() * i)
        return i
    }

    //% subcategory.loc.en="General"
    //% subcategory.loc.nl="Algemeen"
    //% block="wait %time sec"
    //% block.loc.nl="wacht %time sec"
    //% min.defl=1
    export function wait(time: number) {
        MESSAGE = 10000 + time
        if (!PAUSE) handleMessage()
    }

    //% color="#008800"
    //% subcategory.loc.en="General"
    //% subcategory.loc.nl="Algemeen"
    //% block="comment: %dummy"
    //% block.loc.nl="uitleg: %dummy"
    //% min.defl="schrijf hier je uitleg"
    export function comment(dummy: string) {
    }

}