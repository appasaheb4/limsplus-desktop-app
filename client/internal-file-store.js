// const FILE_PATH = 'data/user.json';
// store
// ipcMain.handle('saveData', async (sender, message) => {
//   let data = JSON.stringify(message);
//   let filepath = FILE_PATH;
//   try {
//     if (!fs.existsSync(filepath)) {
//       fs.mkdirSync('data', {recursive: true});
//     }
//     fs.writeFileSync(filepath, data);
//   } catch (err) {
//     console.log({err});
//   }
//   console.log('Data Saved');
// });

// fetch data from local storage
// let isExists = fs.existsSync(FILE_PATH);
// if (isExists) {
//   mainWindow.loadFile(
//     path.join(__dirname, 'src/modules/home', 'home.screen.html')
//   );
// } else {
//   mainWindow.loadFile(
//     path.join(__dirname, 'src/modules/login', 'login.screen.html')
//   );
// }

// read data from local storage

// ipcMain.handle('readJsonData', (event) => {
//   let res = fs.existsSync(FILE_PATH);
//   if (res) {
//     let dt = fs.readFileSync(FILE_PATH);
//     let data = JSON.parse(dt);
//     event.sender.send('userDetails', data);
//   }
// });
