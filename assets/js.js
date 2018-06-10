var canvas = document.getElementById('canvas');
var selected_square = [-1,-1];
var selected_piece;
var p_moves = [];
var chosen_move;

var PAWN = 0;
var KNIGHT = 1;

var WHITE = 0;
var BLACK = 1;
var NOSIDE = -1;
var side = NOSIDE;

var rotate = true;

var white_pieces = [];
var black_pieces = [];

//socket.io
var socket = io();

var chat = {
    messages: document.getElementById('messages'),
    waiting: document.getElementById('waiting_message'),

    showMessage: function(msg) {
        var newMessage = document.createElement("p");
        newMessage.innerHTML = msg;
        chat.messages.appendChild(newMessage);
        chat.messages.scrollTop = chat.messages.scrollHeight;
    },

    showTurn: function(msg) {
        var b_fromx = msg.requested_black.from.x;
        var b_fromy = msg.requested_black.from.y;
        var b_tox = msg.requested_black.to.x;
        var b_toy = msg.requested_black.to.y;

        var w_fromx = msg.requested_white.from.x;
        var w_fromy = msg.requested_white.from.y;
        var w_tox = msg.requested_white.to.x;
        var w_toy = msg.requested_white.to.y;

        var blackTypeImgSrc = (msg.black_move_type === KNIGHT)? '/assets/knightb.png' : '/assets/pawnb.png';
        var whiteTypeImgSrc = (msg.white_move_type === KNIGHT)? '/assets/knightw.png' : '/assets/pawnw.png';
        
        chat.showMessage(
            "<b><img src=" + blackTypeImgSrc + "> " + b_fromx + ", " + b_fromy + " &#x27f6; "  + b_tox + ", " + b_toy + "<br>"
            + "<img src=" + whiteTypeImgSrc + "> " + w_fromx + ", " + w_fromy + " &#x27f6; "  + w_tox + ", " + w_toy + "</b>"
        );

        chat.hideWaiting();
    },

    showStart: function(msg) {
        var sideName = (msg.side === WHITE) ? "white" : "black";
        if (msg.game_name !== undefined) {
            var linkURL = window.location.hostname + "/?" + encodeURI(msg.game_name);
            chat.showMessage("joined <b>" + msg.game_name + "</b> as " + sideName + ". Link to game:<br><b>" + linkURL + "</b>");
            if (window.history)
                window.history.pushState({}, msg.game_name, "?" + encodeURI(msg.game_name));
        } else if (msg.AI) {
            chat.showMessage("joined an AI game as " + sideName + ".");
        } else {
            chat.showMessage("joined random game as " + sideName + ".");
        }
    },

    showEnd: function(msg) {
        if (msg.winner !== undefined) {
            var winText = "TIE! ";
            if (msg.winner === WHITE) winText = "White wins! ";
            if (msg.winner === BLACK) winText = "Black wins! ";
            if (msg.wininfo) winText = winText + "</b>" + msg.wininfo;
            chat.showMessage("<b>Game Over! " + winText + "<button class='pi-button with-shadow' onclick='server.joinRandom();'>new game</button>");
        } else {
            chat.showMessage("Partner disconnected.<button class='pi-button with-shadow' onclick='server.joinRandom();'>new game</button>");
        }

    },

    showWaiting: function () {
        chat.messages.appendChild(chat.waiting);
        chat.waiting.style.display = "block";
        chat.messages.scrollTop = chat.messages.scrollHeight;
    },
    hideWaiting: function hideWaiting() {
        chat.waiting.style.display = "none";
        chat.waiting.remove();
    }
};

function recieveStart(msg) {
    chosen_move = undefined;
    selected_square = [-1, -1];
    p_moves = [];
    side = msg.side;
    if (side === WHITE)
        rotate = true;
    else if (side === BLACK)
        rotate = false;
    if (msg.white_pieces != undefined) white_pieces = msg.white_pieces;
    if (msg.black_pieces != undefined) black_pieces = msg.black_pieces;
    if (msg.side === -1) {
        chat.showEnd(msg);
    } else {
        chat.showStart(msg);
    }
    chat.hideWaiting();
    draw.ctx_draw();
}

function recieveTurn(msg) {
    chosen_move = undefined;
    selected_square = [-1, -1];
    p_moves = [];
    chat.showTurn(msg);
    if (msg.white_pieces != undefined) white_pieces = msg.white_pieces;
    if (msg.black_pieces != undefined) black_pieces = msg.black_pieces;
    draw.ctx_draw();
}

//AI stuff
function deletePiece(piece) {
    var sideToSearch;
    if (piece.side === WHITE) {
        sideToSearch = white_pieces;
    } else {
        sideToSearch = black_pieces;
    }
    for (var a = 0; a < sideToSearch.length; a++) {
        if (comparePieces(sideToSearch[a], piece)) {
            sideToSearch.splice(a,1);
            return;
        }
    }
}
function compareMoves(move1, move2) {
    return move1.to.x === move2.to.x &&
        move1.to.y === move2.to.y &&
        move1.from.x === move2.from.x &&
        move1.from.y === move2.from.y;
}

function comparePieces(piece1, piece2) {
    return piece1.x === piece2.x &&
        piece1.y === piece2.y &&
        piece1.side === piece2.side &&
        piece1.type === piece2.type;
}
var ai = {
    start: function() {
        recieveStart({
            side: WHITE,
            AI: true,
            white_pieces: [{ side: WHITE, type: KNIGHT, x: 0, y: 0 },
                { side: WHITE, type: KNIGHT, x: 4, y: 0 },
                { side: WHITE, type: PAWN, x: 0, y: 1 },
                { side: WHITE, type: PAWN, x: 1, y: 0 },
                { side: WHITE, type: PAWN, x: 2, y: 0 },
                { side: WHITE, type: PAWN, x: 3, y: 0 },
                { side: WHITE, type: PAWN, x: 4, y: 1 }],
            black_pieces: [{ side: BLACK, type: KNIGHT, x: 0, y: 4 },
                { side: BLACK, type: KNIGHT, x: 4, y: 4 },
                { side: BLACK, type: PAWN, x: 0, y: 3 },
                { side: BLACK, type: PAWN, x: 1, y: 4 },
                { side: BLACK, type: PAWN, x: 2, y: 4 },
                { side: BLACK, type: PAWN, x: 3, y: 4 },
                { side: BLACK, type: PAWN, x: 4, y: 3 }]
        });
        draw.ctx_draw();
    },
    turn: function(playerMove) {
        var requested_white;
        var requested_black;
        //get moves for each side
        requested_white = playerMove;

        for (var i = 0; i < black_pieces.length; i++) {
            var moves = getMoves(black_pieces[i]);
            if (moves.length > 0) {
                requested_black = moves[0];
                if (Math.random() > 0.5)
                    break;
            }
        }

        var whitePieceToMove = getPieces(requested_white.from.x,requested_white.from.y)[0];
        var blackPieceToMove = getPieces(requested_black.from.x, requested_black.from.y)[0];

        //APPLICATION
        whitePieceToMove.x = requested_white.to.x;
        whitePieceToMove.y = requested_white.to.y;

        blackPieceToMove.x = requested_black.to.x;
        blackPieceToMove.y = requested_black.to.y;

        if (blackPieceToMove.y === 0) blackPieceToMove.type = KNIGHT;
        if (whitePieceToMove.y === 4) whitePieceToMove.type = KNIGHT;
        //RESOLUTION
        if (whitePieceToMove.x === blackPieceToMove.x && whitePieceToMove.y === blackPieceToMove.y) {
            //if moving to the same square
            if (whitePieceToMove.type > blackPieceToMove.type) {
                deletePiece(blackPieceToMove);
            } else if (whitePieceToMove.type < blackPieceToMove.type) {
                deletePiece(whitePieceToMove);
            } else {
                deletePiece(blackPieceToMove);
                deletePiece(whitePieceToMove);
            }
        }
        var w_conflict = getPieces(whitePieceToMove.x, whitePieceToMove.y);
        if (w_conflict.length === 2) {
            if (comparePieces(whitePieceToMove, w_conflict[0])) {
                deletePiece(w_conflict[1]);
            } else {
                deletePiece(w_conflict[0]);
            }
        }
        var b_conflict = getPieces(blackPieceToMove.x, blackPieceToMove.y);
        if (b_conflict.length === 2) {
            if (comparePieces(blackPieceToMove, b_conflict[0])) {
                deletePiece(b_conflict[1]);
            } else {
                deletePiece(b_conflict[0]);
            }
        }
        //RESPONSE
        ai.turnEnd({
            requested_black: requested_black,
            requested_white: requested_white,
            black_move_type: blackPieceToMove.type,
            white_move_type: whitePieceToMove.type
        });
    },
    turnEnd: function(res) {
        var white_lose = true;
        var black_lose = true;
        for (var a = 0; a < white_pieces.length; a++) {
            if (white_pieces[a].type === PAWN) {
                white_lose = false;
                break;
            }
        }
        for (var a = 0; a < black_pieces.length; a++) {
            if (black_pieces[a].type === PAWN) {
                black_lose = false;
                break;
            }
        }
        if (white_lose && black_lose) {
            recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces, winner: NOSIDE});
        } else if (white_lose) {
            recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces, winner: BLACK});
        } else if (black_lose) {
            recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces, winner: WHITE});
        } else {
            //check that both players have available moves
            var blackHasMoves = false;
            for (var i = 0; i < black_pieces.length; i++) {
                var black_piece = black_pieces[i];
                if (getMoves(black_piece).length > 0) {
                    blackHasMoves = true;
                    break;
                }
            }
            var whiteHasMoves = false;
            for (var i = 0; i < white_pieces.length; i++) {
                var white_piece = white_pieces[i];
                if (getMoves(white_piece).length > 0) {
                    whiteHasMoves = true;
                    break;
                }
            }

            if (!blackHasMoves && !whiteHasMoves) {
                recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces, winner: NOSIDE, wininfo: "Both players had no possible moves!"});
            } else if (!blackHasMoves) {
                recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces, winner: WHITE, wininfo: "Black had no possible moves!"});
            } else if (!whiteHasMoves) {
                recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces, winner: BLACK, wininfo: "White had no possible moves!"});
            } else {
                recieveTurn(res);
            }
        }
    }
};

var server = {
    joinRandom: function() {

        if (side === NOSIDE) {
            socket.emit('join');
            server.turn = function(move) {
                socket.emit('turn', move);
            };
        } else {
            chat.showMessage("You can't start a new game while you are in a game.");
        }
    },

    joinPremade: function(name) {

        if (side === NOSIDE) {
            var gamename = name || window.location.href.split("?", 2)[1];
            if (gamename !== undefined) {
                socket.emit('join', decodeURI(gamename));
            }
            server.turn = function(move) {
                socket.emit('turn', move);
            };
        } else {
            chat.showMessage("You can't start a new game while you are in a game.");
        }
    },

    joinAI: function() {
        if (side === NOSIDE) {
            ai.start();

            server.turn = ai.turn;
        } else {
            chat.showMessage("You can't start a new game while you are in a game.");
        }
    }
};

socket.on('start', recieveStart);
socket.on('turn', recieveTurn);
socket.on('message', chat.showMessage);
socket.on('connect', server.joinPremade);
socket.on('disconnect', function() {
    chat.showMessage("you have disconnected. Try starting a new game in a moment, or refresh your page.");
    recieveStart({side: -1, white_pieces: white_pieces, black_pieces: black_pieces});
});

canvas.addEventListener("mousedown",function(e){
    var rect = canvas.getBoundingClientRect();
    var mouse_x = e.clientX - rect.left;
    var mouse_y = e.clientY - rect.top;

    selectSquare(getSquare(mouse_x, mouse_y));
});

canvas.addEventListener("mouseup",function(e){
    var rect = canvas.getBoundingClientRect();
    var mouse_x = e.clientX - rect.left;
    var mouse_y = e.clientY - rect.top;

    selectSquare(getSquare(mouse_x, mouse_y));
});

function selectSquare(square) {
    selected_square = square;
    if (rotate) {
        selected_square.x = 4 - selected_square.x;
        selected_square.y = 4 - selected_square.y;
    }
    if (chosen_move == undefined) {

        for (var a = 0; a < p_moves.length; a++) {
            if (selected_square.x === p_moves[a].to.x && selected_square.y === p_moves[a].to.y) { //if move is valid

                chat.showWaiting();
                chosen_move = p_moves[a];
                server.turn(chosen_move);

                //for display purposes
                selected_square = { x: selected_piece.x, y: selected_piece.y};
                p_moves = [];
                draw.ctx_draw();
            }
        }
        var newSelect = getPieces(square.x, square.y)[0];

        if (newSelect !== undefined) {
            selected_piece = newSelect;
            //check that it gets a piece?
            p_moves = getMoves(newSelect, side);
            draw.ctx_draw();
        } else if (chosen_move == undefined) {
            selected_square = [-1, -1];
            p_moves = [];
            draw.ctx_draw();
        }
    }
}


//returns the square an x and y fall on
function getSquare(x, y) {
    return { x: Math.floor(x / 65), y: Math.floor(y / 65)};
}

//takes a square: [x, y]
//returns the piece on that square or else undefined
function getPieces(x, y) {
    var pieces = [];
    for (var a = 0; a < white_pieces.length; a++) {
        if (white_pieces[a].x === x && white_pieces[a].y === y) {
            pieces.push(white_pieces[a]);
        }
    }
    for (var a = 0; a < black_pieces.length; a++) {
        if (black_pieces[a].x === x && black_pieces[a].y === y) {
            pieces.push(black_pieces[a]);
        }
    }
    return pieces;
}
//takes a piece: {side, type, x, y}
//returns moves: [{from:{x, y}, to:{x,y}}, ...]
function getMoves(piece, playSide) {
    var moves = [];

    if (playSide !== undefined && playSide !== piece.side) {
        return [];
    }
    if (piece.type === 0) {
        var way = -1;
        if (piece.side === WHITE) way = 1;

        var temp = getPieces(piece.x-1,piece.y+way)[0];
        if (temp !== undefined && temp.side !== piece.side) {
            moves.push({
                from: {x: piece.x, y: piece.y},
                to: {x: piece.x - 1, y: piece.y + way}
            });
        }
        temp = getPieces(piece.x+1,piece.y+way)[0];
        if (temp !== undefined && temp.side !== piece.side) {
            moves.push({
                from: {x: piece.x, y: piece.y},
                to: {x: piece.x + 1, y: piece.y + way}
            });
        }
        temp = getPieces(piece.x,piece.y+way)[0];
        if (temp === undefined) {
            moves.push({
                from: {x: piece.x, y: piece.y},
                to: {x: piece.x, y: piece.y + way}
            });
        }
        return moves;
    }
    if (piece.type === 1) {
        var k_d = [[-1,2],[1,2],[-1,-2],[1,-2],[2,-1],[2,1],[-2,-1],[-2,1]]; //possible knight moves
        for (var a = 0; a < k_d.length; a++) {
            var x = piece.x+k_d[a][0];
            var y = piece.y+k_d[a][1];
            var overlapPiece = getPieces(x,y)[0];
            if (x >= 0 && x < 5 && y >= 0 && y < 5 && (overlapPiece === undefined || overlapPiece.side !== piece.side)) {
                moves.push({
                    from: { x: piece.x, y: piece.y },
                    to: { x: x, y: y}
                });
            }
        }
        return moves;
    }
}

var modal = document.getElementById('modal');
var modal_input = document.getElementById('modal-input');
var modal_back = document.getElementById('modal-back');
var modal_button = document.getElementById('modal-button');

modal_input.value = "";
modal.style.display = "none";
modal.style.opacity = 0;
modal.style.webkitAnimationName = "";

function modal_action(out) {
    if (out) {
        if (modal_input.value != "") {
            server.joinPremade(modal_input.value);
        }
        modal_input.value = "";
        modal.style.display = "none";
        modal.style.opacity = 0;
        modal.style.webkitAnimationName = "";
        modal_back.style.display = "none";
        modal_back.style.webkitAnimationName = "";
    } else {
        modal.style.display = "block";
        modal.style.opacity = 1;
        modal.style.webkitAnimationName = "modal-in";
        modal_back.style.display = "block";
        modal_back.style.webkitAnimationName = "fade-in";
        modal_input.focus();
    }
}

modal_input.onkeypress=function(e){
    if(e.keyCode==13){
        modal_button.click();
    }
};

var draw = {};

if (canvas.getContext) {
    var ctx = canvas.getContext('2d');

    var img_wknight = new Image();
    img_wknight.src = 'assets/knightw.png';
    var img_wpawn = new Image();
    img_wpawn.src = 'assets/pawnw.png';
    var img_bknight = new Image();
    img_bknight.src = 'assets/knightb.png';
    var img_bpawn = new Image();
    img_bpawn.src = 'assets/pawnb.png';
    var img_select = new Image();
    img_select.src = 'assets/select.png';

    function ctx_draw() {
        ctx.clearRect(0,0, canvas.width, canvas.height);

        if (rotate) { //flip visuals so white is on bottom
            ctx.drawImage(img_select, 260-selected_square.x * 65, 260-selected_square.y * 65);
        } else {
            ctx.drawImage(img_select, selected_square.x * 65, selected_square.y * 65);
        }
        for (var a = 0; a < white_pieces.length; a++) {
            var piece_x = white_pieces[a].x*65;
            var piece_y = white_pieces[a].y*65;
            if (rotate) {
                //flip display so white is on bottom
                piece_x = 260 - piece_x;
                piece_y = 260 - piece_y;
            }
            if (white_pieces[a].type === KNIGHT) {
                ctx.drawImage(img_wknight, piece_x, piece_y);
            } else {
                ctx.drawImage(img_wpawn, piece_x, piece_y);
            }
        }
        for (var a = 0; a < black_pieces.length; a++) {
            var piece_x = black_pieces[a].x*65;
            var piece_y = black_pieces[a].y*65;
            if (rotate) {
                //flip display so white is on bottom
                piece_x = 260 - piece_x;
                piece_y = 260 - piece_y;
            }
            if (black_pieces[a].type === KNIGHT) {
                ctx.drawImage(img_bknight, piece_x, piece_y);
            } else {
                ctx.drawImage(img_bpawn, piece_x, piece_y);
            }
        }

        for (var a = 0; a < p_moves.length; a++) {
            ctx.fillStyle = "rgba(50, 50, 250, 0.4)";
            if (rotate) { //flip visuals so white is on bottom
                ctx.fillRect(260-p_moves[a].to.x*65, 260-p_moves[a].to.y*65, 65, 65);
            } else {
                ctx.fillRect(p_moves[a].to.x*65, p_moves[a].to.y*65, 65, 65);
            }

        }

        if (chosen_move != undefined) {
            ctx.fillStyle = "rgba(250, 50, 50, 0.4)";
            if (rotate) { //flip visuals so white is on bottom
                ctx.fillRect(260-chosen_move.to.x * 65, 260-chosen_move.to.y * 65, 65, 65);
            } else {
                ctx.fillRect(chosen_move.to.x * 65, chosen_move.to.y * 65, 65, 65);
            }
        }

    }

    img_wknight.addEventListener("load", ctx_draw, false);
    img_wpawn.addEventListener("load", ctx_draw, false);
    img_bknight.addEventListener("load", ctx_draw, false);
    img_bpawn.addEventListener("load", ctx_draw, false);
    img_select.addEventListener("load", ctx_draw, false);

    draw.ctx_draw = ctx_draw;
} else {
    chat.showMessage("Sorry, your browser doesn't support Apocalypse. Try chrome.")
}