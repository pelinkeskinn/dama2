const socket = io();

window.addEventListener("load", () => {
  const savedUsername = localStorage.getItem("rejoin_username");
  if (savedUsername) {
    username = savedUsername;

    // Tekrar sunucuya bildir
    socket.emit("join", {
      username: username,
      room: room,
      color: null // renk seçimini tekrar yapacak
    });

    document.getElementById("joinForm").style.display = "block";

    localStorage.removeItem("rejoin_username");
  }
});




let currentPlayerColor = null;
const boardSize = 8;
const cellSize = 60;


let selectedPiece = null;
let currentTurn = "red";
let room = null;
let mustContinue = false;

let timer = null;
let timeLeft = 30;
// Oda Formu gönderildiğinde çalışır
document.getElementById("joinForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const input = document.getElementById("roomInput").value.trim();
  const selectedColor = document.querySelector('input[name="color"]:checked');

  if (!input || !selectedColor) {
    alert("Lütfen oda adı ve renk seçiniz.");
    return;
  }

  room = input;
  currentPlayerColor = selectedColor.value;

  socket.emit("join", {
    username: username,
    room: room,
    color: currentPlayerColor
  });

  // UI geçişi
  document.getElementById("joinForm").style.display = "none";
});


function createBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.row = row;
      cell.dataset.col = col;

      if ((row + col) % 2 === 0) {
        cell.classList.add("light");
      } else {
        cell.classList.add("dark");
      }

      cell.style.width = `${60}px`;
      cell.style.height = `${60}px`;

      board.appendChild(cell);
    }
  }

  board.style.gridTemplateColumns = `repeat(${boardSize}, 60px)`;
  board.style.width = `${boardSize * 60}px`;
  board.style.margin = "auto";
  board.style.display = "grid";
  bindCellEvents();
}



// Renk atanması cevabı
socket.on("assign_color", (color) => {
  if (color === "rejected") {
    alert("Bu renk zaten seçilmiş. Lütfen başka bir renk seçin.");
    location.reload();
    return;
  }

  currentPlayerColor = color;
  createBoard();
  addPieces();
  document.getElementById("board").style.display = "grid";
  document.getElementById("joinForm").style.display = "none";
  hideFormAndTimer();

  console.log("Seçilen renk:", currentPlayerColor);
});


socket.on("move_made", (data) => {
  const fromIndex = data.fromRow * boardSize + data.fromCol;
  const toIndex = data.toRow * boardSize + data.toCol;
  const cells = document.querySelectorAll(".cell");
  const fromCell = cells[fromIndex];
  const toCell = cells[toIndex];

  // Taşı hareket ettir
  const piece = fromCell.querySelector(".piece");
  if (piece) {
    piece.dataset.row = data.toRow;
    piece.dataset.col = data.toCol;
    toCell.appendChild(piece);
  }

  // Yenen taş varsa sil
  if (data.capturedIndex !== undefined) {
    const capturedCell = cells[data.capturedIndex];
    const capturedPiece = capturedCell.querySelector(".piece");
    if (capturedPiece) capturedCell.removeChild(capturedPiece);
  }

  // Taş yeni konumuna geldiğinde tekrar seç (eğer gerekiyorsa)
  const movedPiece = toCell.querySelector(".piece");

  // Vezir olmuşsa class ekle
  if (data.becameQueen && movedPiece) {
    movedPiece.classList.add("queen");
  }

  // Zincirleme yeme durumu
  if (data.mustContinue) {
    selectedPiece = movedPiece;
    mustContinue = true;
  } else {
    selectedPiece = null;
    mustContinue = false;
  }
});


socket.on("turn_update", (nextTurn) => {
  clearInterval(timer);  // Önceki sayaç durdurulur
  currentTurn = nextTurn;
  console.log("Yeni sıra:", currentTurn);

  timeLeft = 30;
  const timerDiv = document.getElementById("timer");

  if (currentPlayerColor === currentTurn) {
    timer = setInterval(() => {
      if (timerDiv) timerDiv.textContent = `Kalan süre: ${timeLeft}s`;
      console.log(`Kalan süre: ${timeLeft}s`);
      timeLeft--;

      if (timeLeft < 0) {
        clearInterval(timer);
        alert("Süreniz doldu! Kaybettiniz.");
        socket.emit("game_over", {
          room,
          winner: currentPlayerColor === "red" ? "Siyah" : "Beyaz"
        });
      }
    }, 1000);
  } else {
    // Sıra sende değilse "Rakip oynuyor..." yaz
    if (timerDiv) timerDiv.textContent = "Rakip oynuyor...";
  }
});



socket.on("player_joined", (players) => {
  const listDiv = document.getElementById("playerList");
  if (!listDiv) return;

  listDiv.innerHTML = "<h3>Oyuncular</h3>";

  const entries = Object.entries(players);

  entries.forEach(([name, color]) => {
    const renk = color === "red" ? "Beyaz" : "Siyah";
    const item = document.createElement("div");
    item.textContent = `${name} (${renk})`;
    listDiv.appendChild(item);
  });
});

function showMessage(msg) {
  const box = document.getElementById("messageBox");
  if (!box) return;

  box.textContent = msg;
  box.style.display = "block";

  setTimeout(() => {
    box.style.display = "none";
    box.textContent = "";
  }, 3000);
}

function addPieces() {
  const cells = document.querySelectorAll(".cell");
  cells.forEach((cell, index) => {
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    if ((row + col) % 2 === 1) {
      if (row < 3) {
        const piece = document.createElement("div");
        piece.classList.add("piece", "black");
        piece.dataset.row = row;
        piece.dataset.col = col;
        cell.appendChild(piece);
      }
      if (row > 4) {
        const piece = document.createElement("div");
        piece.classList.add("piece", "red");
        piece.dataset.row = row;
        piece.dataset.col = col;
        cell.appendChild(piece);
      }
    }
  });
  bindCellEvents();

}

addPieces();
function getDirections(piece) {
  // Vezirler için, her yönde hareket edebilir
  if (piece.classList.contains("queen")) {
    return [{dr: 1, dc: 1}, {dr: 1, dc: -1}, {dr: -1, dc: 1}, {dr: -1, dc: -1}];
  }
  // Normal taşlar için
  return piece.classList.contains("red") ? [-1] : [1];
}




function canCaptureAgain(piece) {
  const row = parseInt(piece.dataset.row);
  const col = parseInt(piece.dataset.col);
  const isQueen = piece.classList.contains("queen");
  const cells = document.querySelectorAll(".cell");

  if (isQueen) {
    // Vezir için 4 yönde de kontrol et
    const directions = [
      {rowStep: 1, colStep: 1},
      {rowStep: 1, colStep: -1},
      {rowStep: -1, colStep: 1},
      {rowStep: -1, colStep: -1}
    ];
    
    for (const dir of directions) {
      let curRow = row + dir.rowStep;
      let curCol = col + dir.colStep;
      let foundOpponent = false;
      
      while (curRow >= 0 && curRow < boardSize && curCol >= 0 && curCol < boardSize) {
        const index = curRow * boardSize + curCol;
        const cell = cells[index];
        const cellPiece = cell.querySelector(".piece");
        
        if (cellPiece) {
          const pieceColor = piece.classList.contains("red") ? "red" : "black";
          const cellColor = cellPiece.classList.contains("red") ? "red" : "black";
          
          if (cellColor === pieceColor) {
            // Kendi taşımız, bu yönde yeme yok
            break;
          } else if (!foundOpponent) {
            // İlk rakip taşı bulduk
            foundOpponent = true;
            curRow += dir.rowStep;
            curCol += dir.colStep;
          } else {
            // İkinci taş bulduk, yiyemeyiz
            break;
          }
        } else if (foundOpponent) {
          // Rakip taşını geçtik ve boş hücre bulduk, yiyebiliriz
          return true;
        } else {
          // Boş hücre, devam et
          curRow += dir.rowStep;
          curCol += dir.colStep;
        }
      }
    }
    
    return false;
  } else {
    // Normal taşlar için mevcut kodunuzu kullanın
    const directions = getDirections(piece);
    const dir = directions[0];
  
    for (let dir of directions) {
      const targets = [
        { r: row + dir * 2, c: col + 2 },
        { r: row + dir * 2, c: col - 2 }
      ];

      for (let t of targets) {
        if (t.r < 0 || t.r >= boardSize || t.c < 0 || t.c >= boardSize) continue;

        const midR = row + dir;
        const midC = (col + t.c) / 2;
        if (!Number.isInteger(midC)) continue;

        const midIndex = midR * boardSize + midC;
        const targetIndex = t.r * boardSize + t.c;

        const midCell = cells[midIndex];
        const targetCell = cells[targetIndex];
        if (!midCell || !targetCell) continue;

        const midPiece = midCell.querySelector(".piece");
        const targetPiece = targetCell.querySelector(".piece");

        if (midPiece && !midPiece.classList.contains(currentPlayerColor) && !targetPiece) {
          return true;
        }
      }
    }

    return false;
  }
}

function mustCapture(color) {
  const cells = document.querySelectorAll(".cell");
  const mustCapturePieces = [];

  for (let i = 0; i < cells.length; i++) {
    const piece = cells[i].querySelector(".piece");
    if (!piece || !piece.classList.contains(color)) continue;

    const row = parseInt(piece.dataset.row);
    const col = parseInt(piece.dataset.col);
    const isQueen = piece.classList.contains("queen");
    
    if (isQueen) {
      // Vezir için taş yeme kontrolü
      const directions = [
        {rowStep: 1, colStep: 1},
        {rowStep: 1, colStep: -1},
        {rowStep: -1, colStep: 1},
        {rowStep: -1, colStep: -1}
      ];
      
      for (const dir of directions) {
        let curRow = row + dir.rowStep;
        let curCol = col + dir.colStep;
        let foundOpponent = false;
        
        while (curRow >= 0 && curRow < boardSize && curCol >= 0 && curCol < boardSize) {
          const index = curRow * boardSize + curCol;
          const cell = cells[index];
          const cellPiece = cell.querySelector(".piece");
          
          if (cellPiece) {
            const cellColor = cellPiece.classList.contains("red") ? "red" : "black";
            
            if (cellColor === color) {
              // Kendi taşımız, bu yönde yeme yok
              break;
            } else if (!foundOpponent) {
              // İlk rakip taşı bulduk
              foundOpponent = true;
              curRow += dir.rowStep;
              curCol += dir.colStep;
            } else {
              // İkinci taş bulduk, yiyemeyiz
              break;
            }
          } else if (foundOpponent) {
            // Rakip taşını geçtik ve boş hücre bulduk, yiyebiliriz
            mustCapturePieces.push(piece);
            break;
          } else {
            // Boş hücre, devam et
            curRow += dir.rowStep;
            curCol += dir.colStep;
          }
        }
        
        if (mustCapturePieces.includes(piece)) break;
      }
    } else {
      // Normal taşlar için mevcut kodu koruyun
      const directions = getDirections(piece);

      for (let dir of directions) {
        const targets = [
          { r: row + dir * 2, c: col + 2 },
          { r: row + dir * 2, c: col - 2 }
        ];

        for (let t of targets) {
          const midR = row + dir;
          const midC = (col + t.c) / 2;
          if (
            t.r >= 0 && t.r < boardSize &&
            t.c >= 0 && t.c < boardSize &&
            midR >= 0 && midR < boardSize &&
            midC >= 0 && midC < boardSize &&
            Number.isInteger(midC)
          ) {
            const midIndex = midR * boardSize + midC;
            const targetIndex = t.r * boardSize + t.c;

            const midCell = cells[midIndex];
            const targetCell = cells[targetIndex];
            if (!midCell || !targetCell) continue;

            const midPiece = midCell.querySelector(".piece");
            const targetPiece = targetCell.querySelector(".piece");

            if (midPiece && !midPiece.classList.contains(color) && !targetPiece) {
              mustCapturePieces.push(piece);
            }
          }
        }
      }
    }
  }

  return mustCapturePieces;
}

// Olası hamleleri gösterme fonksiyonu
function showPossibleMoves(piece) {
  if (!piece) return;
  
  const cells = document.querySelectorAll(".cell");
  const row = parseInt(piece.dataset.row);
  const col = parseInt(piece.dataset.col);
  const isQueen = piece.classList.contains("queen");
  
  // Önce tüm vurguları temizle
  clearHighlights();
  
  // Taş yeme zorunluluğu varsa
  const mustList = mustCapture(currentPlayerColor);
  if (mustList.length > 0) {
    // Bu taş yiyebilir mi kontrol et
    const canCapture = mustList.some(p => 
      parseInt(p.dataset.row) === row && parseInt(p.dataset.col) === col
    );
    
    if (!canCapture) return; // Yiyemiyorsa hamle gösterme
  }
  
  if (isQueen) {
    // Vezir için tüm çapraz yönleri kontrol et
    const directions = [
      {rowStep: 1, colStep: 1},
      {rowStep: 1, colStep: -1},
      {rowStep: -1, colStep: 1},
      {rowStep: -1, colStep: -1}
    ];
    
    for (const dir of directions) {
      let curRow = row + dir.rowStep;
      let curCol = col + dir.colStep;
      let foundOpponent = false;
      let opponentRow = -1;
      let opponentCol = -1;
      
      while (curRow >= 0 && curRow < boardSize && curCol >= 0 && curCol < boardSize) {
        const index = curRow * boardSize + curCol;
        const curCell = cells[index];
        const curPiece = curCell.querySelector(".piece");
        
        if (curPiece) {
          const curColor = curPiece.classList.contains("red") ? "red" : "black";
          const pieceColor = piece.classList.contains("red") ? "red" : "black";
          
          if (curColor === pieceColor) {
            // Kendi taşımız, bu yönde hareket yok
            break;
          } else if (!foundOpponent) {
            // İlk rakip taşı bulduk
            foundOpponent = true;
            opponentRow = curRow;
            opponentCol = curCol;
            curRow += dir.rowStep;
            curCol += dir.colStep;
          } else {
            // İkinci taş bulduk, yiyemeyiz
            break;
          }
        } else if (foundOpponent) {
          // Rakip taşını geçtik ve boş hücre bulduk, yiyebiliriz
          const captureIndex = opponentRow * boardSize + opponentCol;
          curCell.classList.add("possible-move");
          curCell.dataset.captureRow = opponentRow;
          curCell.dataset.captureCol = opponentCol;
          // Yeme hamlesi olduğunda bir sonraki hamleye devam etmiyoruz
          break;
        } else if (mustList.length === 0) {
          // Normal hamle (yeme zorunluluğu yoksa)
          curCell.classList.add("possible-move");
          curRow += dir.rowStep;
          curCol += dir.colStep;
        } else {
          // Yeme zorunluluğu varsa normal hamle gösterme
          curRow += dir.rowStep;
          curCol += dir.colStep;
        }
      }
    }
  } else {
    // Normal taşlar için mevcut kodu koruyoruz
    const direction = getDirections(piece)[0];
    const possibleMoves = [
      { r: row + direction, c: col + 1 },
      { r: row + direction, c: col - 1 }
    ];
    
    // Taş yeme hamlelerini kontrol et
    const captureMoves = [
      { r: row + direction * 2, c: col + 2, midR: row + direction, midC: col + 1 },
      { r: row + direction * 2, c: col - 2, midR: row + direction, midC: col - 1 },
      { r: row - direction * 2, c: col + 2, midR: row - direction, midC: col + 1 },
      { r: row - direction * 2, c: col - 2, midR: row - direction, midC: col - 1 }
    ];
    
    // Yeme hamleleri varsa, sadece onları göster
    let hasCapture = false;
    
    for (const move of captureMoves) {
      if (move.r < 0 || move.r >= boardSize || move.c < 0 || move.c >= boardSize) continue;
      
      const midIndex = move.midR * boardSize + move.midC;
      const targetIndex = move.r * boardSize + move.c;
      
      const midCell = cells[midIndex];
      const targetCell = cells[targetIndex];
      if (!midCell || !targetCell) continue;
      
      const midPiece = midCell.querySelector(".piece");
      const targetPiece = targetCell.querySelector(".piece");
      
      if (midPiece && !midPiece.classList.contains(currentPlayerColor) && !targetPiece) {
        targetCell.classList.add("possible-move");
        targetCell.dataset.captureRow = move.midR;
        targetCell.dataset.captureCol = move.midC;
        hasCapture = true;
      }
    }
    
    // Yeme hamlesi yoksa normal hamleleri göster
    if (!hasCapture && mustList.length === 0) {
      for (const move of possibleMoves) {
        if (move.r < 0 || move.r >= boardSize || move.c < 0 || move.c >= boardSize) continue;
        
        const index = move.r * boardSize + move.c;
        const cell = cells[index];
        if (!cell) continue;
        
        const cellPiece = cell.querySelector(".piece");
        if (!cellPiece) {
          cell.classList.add("possible-move");
        }
      }
    }
  }
}

// Vurguları temizle
function clearHighlights() {
  document.querySelectorAll(".possible-move").forEach(cell => {
    cell.classList.remove("possible-move");
    delete cell.dataset.captureRow;
    delete cell.dataset.captureCol;
  });
}

// Vezir için geçerli hamle kontrolü
function isValidQueenMove(fromRow, fromCol, toRow, toCol) {
  // Çapraz hareket değilse geçersiz
  if (Math.abs(toRow - fromRow) !== Math.abs(toCol - fromCol)) return false;
  
  const rowStep = toRow > fromRow ? 1 : -1;
  const colStep = toCol > fromCol ? 1 : -1;
  const cells = document.querySelectorAll(".cell");
  
  let curRow = fromRow + rowStep;
  let curCol = fromCol + colStep;
  
  // DÜZELTİLDİ: Bu koşul düzeltildi - hedef hücreye ulaşana kadar kontrol et
  while ((rowStep > 0 ? curRow < toRow : curRow > toRow) && 
         (colStep > 0 ? curCol < toCol : curCol > toCol)) {
    const index = curRow * boardSize + curCol;
    const cell = cells[index];
    if (cell && cell.querySelector(".piece")) {
      return false; // Yol üzerinde taş var
    }
    curRow += rowStep;
    curCol += colStep;
  }
  
  return true;
}

// Tüm taş hareketlerini işleyen fonksiyon
function bindCellEvents() {
  document.querySelectorAll(".cell").forEach((cell, index) => {
    // Tıklanabilir görünümü güçlendir
    if (cell.classList.contains("dark")) {
      cell.style.cursor = "pointer";
    }
    
    cell.addEventListener("click", (event) => {
      // Debug bilgisi
      console.log("Hücre tıklandı:", {
        row: Math.floor(index / boardSize),
        col: index % boardSize,
        hasPiece: !!cell.querySelector(".piece"),
        isPossibleMove: cell.classList.contains("possible-move"),
        selectedPiece: selectedPiece ? {
          row: parseInt(selectedPiece.dataset.row),
          col: parseInt(selectedPiece.dataset.col),
          isQueen: selectedPiece.classList.contains("queen")
        } : null
      });
      
      // Olay yayılımını durdur
      event.stopPropagation();
      
      // Önceki tüm seçili taşların sarı çerçevesini kaldır
      document.querySelectorAll(".piece.selected").forEach(p => p.classList.remove("selected"));
      
      if (!currentPlayerColor || currentTurn !== currentPlayerColor) return;

      const piece = cell.querySelector(".piece");
      const row = Math.floor(index / boardSize);
      const col = index % boardSize;
      const mustList = mustCapture(currentPlayerColor);

      // Taş seçimi
      if (piece && piece.classList.contains(currentPlayerColor)) {
        const isInMustList = mustList.some(p => parseInt(p.dataset.row) === row && parseInt(p.dataset.col) === col);
        if (mustList.length > 0 && !isInMustList && !mustContinue) {
          showMessage("Yeme zorunlu! Sadece yiyebilecek taşlarla oynayabilirsiniz.");
          return;
        }
        if (!mustContinue || (selectedPiece && selectedPiece === piece)) {
          selectedPiece = piece;
          piece.classList.add("selected");
          
          // Olası hamleleri göster
          clearHighlights();
          showPossibleMoves(piece);
        }
        return;
      }

      // Hamle yapılması - bir taş seçiliyse ve tıklanan hücre boşsa
      if (selectedPiece && !piece) {
        console.log("Hamle yapmaya çalışılıyor");
        
        const fromRow = parseInt(selectedPiece.dataset.row);
        const fromCol = parseInt(selectedPiece.dataset.col);
        const toRow = row;
        const toCol = col;
        const rowDiff = toRow - fromRow;
        const colDiff = toCol - fromCol;
        const isQueen = selectedPiece.classList.contains("queen");

        let isValid = false;
        let capturedIndex = undefined;

        // Olası hamle mi kontrol et - hücrenin vurgulu olup olmadığını kontrol et
        if (!cell.classList.contains("possible-move")) {
          console.log("Hamle geçersiz: Hücre vurgulu değil");
          selectedPiece?.classList.remove("selected");
          selectedPiece = null;
          return;
        }

        // Yenen taş varsa
        if (cell.dataset.captureRow && cell.dataset.captureCol) {
          const captureRow = parseInt(cell.dataset.captureRow);
          const captureCol = parseInt(cell.dataset.captureCol);
          capturedIndex = captureRow * boardSize + captureCol;
          isValid = true;
          console.log("Yeme hamlesi geçerli");
        } else if (isQueen) {
          // Vezir için normal hamle kontrolü
          isValid = isValidQueenMove(fromRow, fromCol, toRow, toCol);
          console.log("Vezir hamlesi kontrol edildi:", isValid);
        } else if (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) {
          // Normal taş için normal hamle
          const dir = getDirections(selectedPiece)[0];
          isValid = Math.sign(rowDiff) === dir;
          console.log("Normal hamle kontrol edildi:", isValid);
        }

        if (mustList.length > 0 && capturedIndex === undefined) {
          showMessage("Yeme zorunlu! Bu hamle geçerli değil.");
          selectedPiece?.classList.remove("selected");
          selectedPiece = null;
          return;
        }

        if (isValid) {
          console.log("Hamle geçerli. Taşı hareket ettiriyorum.");
          
          // Taşı görsel olarak hareket ettir
          selectedPiece.dataset.row = toRow;
          selectedPiece.dataset.col = toCol;
          
          // Önceki hücreden kaldır (gereksiz olabilir ama önlem için)
          const fromCell = document.querySelector(`.cell[data-row="${fromRow}"][data-col="${fromCol}"]`);
          if (fromCell && fromCell.contains(selectedPiece)) {
            fromCell.removeChild(selectedPiece);
          }
          
          // Yeni hücreye ekle
          cell.appendChild(selectedPiece);

          // Yenen taş varsa görsel olarak da kaldır
          if (capturedIndex !== undefined) {
            const capturedCell = document.querySelectorAll(".cell")[capturedIndex];
            const capturedPiece = capturedCell.querySelector(".piece");
            if (capturedPiece) {
              capturedCell.removeChild(capturedPiece);
            }
          }

          // Zincirleme yeme kontrolü
          const willContinue = capturedIndex !== undefined && canCaptureAgain(selectedPiece);
          
          // Hamleyi sunucuya bildir
          socket.emit("make_move", {
            room,
            fromRow,
            fromCol,
            toRow,
            toCol,
            capturedIndex,
            color: currentPlayerColor,
            mustContinue: willContinue
          });

          if (!willContinue) {
            selectedPiece?.classList.remove("selected");
            selectedPiece = null;
          } else {
            console.log("Zincirleme yeme devam ediyor");
            clearHighlights();
            showPossibleMoves(selectedPiece);
          }
        } else {
          console.log("Hamle geçersiz.");
          selectedPiece?.classList.remove("selected");
          selectedPiece = null;
        }
      }
    });
  });
}

socket.on("check_pieces", () => {
  const cells = document.querySelectorAll(".cell");
  let redCount = 0;
  let blackCount = 0;

  cells.forEach(cell => {
    const piece = cell.querySelector(".piece");
    if (piece) {
      if (piece.classList.contains("red")) redCount++;
      if (piece.classList.contains("black")) blackCount++;
    }
  });

  let winner = null;
  if (redCount === 0) winner = "Siyah";
  else if (blackCount === 0) winner = "Beyaz";

  if (winner) {
    socket.emit("game_over", { room, winner });
  }
});
socket.on("game_over", (data) => {
  clearInterval(timer);  // Sayaç durdurulur

  const timerDiv = document.getElementById("timer");
  if (timerDiv) {
    timerDiv.textContent = `🛑 Oyun bitti! Kazanan: ${data.winner}`;
    timerDiv.style.color = "green";
    timerDiv.style.fontWeight = "bold";
  }
});
bindCellEvents(); // tahta kurulum işlevi

// ► Burayı dosyanın en altına ekleyin:
document.getElementById('restartBtn').addEventListener('click', () => {
  socket.emit('restart_game', { room });
});
// ► "Tekrar Oyna" butonuna basıldığında sunucuya restart isteği yollayın
document.getElementById('restartBtn').addEventListener('click', () => {
  socket.emit('restart_game', { room });
});

// ► Sunucudan reset geldiğinde oyun durumunu başa döndürün
socket.on('game_reset', () => {
  clearInterval(timer);      // Sayaç durdur
  createBoard();             // Tahtayı yeniden çiz
  addPieces();               // 🟩 Eksik olan bu satır!
  selectedPiece = null;
  mustContinue = false;
  currentTurn = 'red';       // İlk sıra beyazda (red) başlasın
  timeLeft = 30;             // Sayaçı sıfırla
  hideFormAndTimer();        // Paneli eski haline getir
  showMessage('Yeni oyun başladı!');
});

// ... en alttaki son kodlardan sonra

function hideFormAndTimer() {
  document.getElementById('joinForm').style.display = 'none';
  document.getElementById('timer').style.display = 'block';
  document.getElementById('playerList').style.display = 'block';
  document.getElementById('restartBtn').style.display = 'block';
}







