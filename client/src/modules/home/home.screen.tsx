const Home = () => {
  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-500 min-h-screen">
      <div className="flex header justify-between w-full">
        <div className="flex">
          <span className="active">Origin</span>
          <span>Notification</span>
          <span>Clipboard Parser</span>
        </div>
        <div className="flex">
          <span id="userId">Welcome </span>
        </div>
      </div>
      <div className="container">
        <div className="column workspaces">
          <div className="title">Workspaces</div>
          <div className="section">Global</div>
          <button className="item">Integration Gateway</button>
          <button className="item">LimsPlus Lite</button>
          <button className="item">Backup/Restore</button>
        </div>
        <div className="column reports">
          <div className="title">Reports</div>
          <button className="item">Aged/Odd Lot</button>
        </div>
      </div>
    </div>
  );
};

export default Home;
