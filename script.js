const new_link_button = document.getElementById("new_link");
const link_input_box = document.getElementById("input_box");
const paperContainer = document.getElementById("paper-container");
const linkContainer = document.getElementById("link-container");

/** utility functions */

function download(filename, text) {
  var element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

class DataStore {
  getData() {
    throw Error("method getData should be implemented");
  }

  updateData(data) {
    throw Error("method getData should be implemented");
  }
}

class LocalStore extends DataStore {
  key = "data";

  constructor(key) {
    super();

    this.key = key;
  }

  getData() {
    return JSON.parse(localStorage.getItem(this.key));
  }

  updateData(data) {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  removeKey() {
    localStorage.removeItem(this.key);
  }
}

class RemoteStore extends DataStore {
  constructor() {
    super();

    this.remoteKeyStore = new LocalStore("remote_key");
    let remoteKey = this.remoteKeyStore.getData();

    if (remoteKey === null) {
      remoteKey = crypto.randomUUID();
      this.remoteKeyStore.updateData(remoteKey);
    }

    this.remoteKey = remoteKey;
  }

  async getData() {
    const data = await (await fetch("/api/data?id=" + this.remoteKey)).json();
    return data;
  }

  async updateData(data) {
    return fetch("/api/data?id=" + this.remoteKey, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  setRemoteId(id) {
    this.remoteKey = id;
    this.remoteKeyStore.updateData(id);
  }
}

class LocalDataManager {
  update = console.log;
  arxivUtility = new ArxivUtility();

  constructor(onUpdate) {
    this.paperStore = new LocalStore("data_paper");
    this.linkStore = new LocalStore("data_links");

    if (onUpdate) this.update = onUpdate;
  }

  async addPaper(/** @type {string} */ id) {
    const result = await this.arxivUtility.fetchPaperData(id);

    const paperData = this.paperStore.getData() || [];

    if (!result || !paperData.map((a) => a.id).includes(result.id))
      paperData.push(result),
        this.paperStore.updateData(paperData),
        this.update("add paper - " + result.id, this.getAllData());
  }

  removePaper(id) {
    let data = this.paperStore.getData();

    data = data.filter((val) => val.id != id);
    if (!data.length) this.paperStore.removeKey();
    else this.paperStore.updateData(data);

    this.update("remove paper - " + id, this.getAllData());
  }

  addLink(link) {
    let data = this.linkStore.getData() || [];

    if (data.indexOf(link) === -1)
      data.push(link),
        this.linkStore.updateData(data),
        this.update("add link - " + link, this.getAllData());
  }

  removeLink(link) {
    let data = this.linkStore.getData();

    data = data.filter((val) => val != link);
    if (!data.length) this.linkStore.removeKey();

    this.linkStore.updateData(data);
    this.update("remove link - " + link, this.getAllData());
  }

  clearData() {
    this.paperStore.removeKey();
    this.linkStore.removeKey();

    this.update("remove all", this.getAllData());
  }

  getAllData() {
    return {
      papers: this.paperStore.getData() || [],
      links: this.linkStore.getData() || [],
    };
  }

  exportData() {
    if (this.paperStore.getData() || this.linkStore.getData())
      download("export.json", JSON.stringify(this.getAllData()));
    else {
      alert("No data available to export!");
      return;
    }
  }

  importData(data) {
    if (!data) data = prompt("Paste the exported data");
    try {
      let { links, papers } = this.getAllData();
      let new_data = JSON.parse(data);
      let new_paper_data = new_data.papers.filter(
        (val) => !papers.map((val) => val.id).includes(val.id)
      );

      if (new_paper_data) {
        for (let i of new_paper_data) {
          papers.push(i);
        }
        this.paperStore.updateData(papers);
      }

      new_data = new_data.links.filter((val) => !links.includes(val));

      if (new_data) {
        for (let i of new_data) {
          links.push(i);
        }

        this.linkStore.updateData(links);
        this.update("add all", this.getAllData());
      }
    } catch (error) {
      console.error(error);
      throw new Error("Error occured while importing!");
    }
  }
}

class ArxivUtility {
  parser = new XMLParser();

  #filterPaperData(xmlData, id) {
    const data = this.parser.parse(xmlData);

    if (!data || !data.feed || !data.feed.id)
      throw new Error("invalid data received");

    return new PaperData(data.feed.entry.id, data.feed.entry, id);
  }

  async fetchPaperData(id) {
    const response = await fetch(
      `https://export.arxiv.org/api/query?id_list=${id}`
    );
    if (response.status !== 200) {
      throw new Error("invalid response from Arxiv");
    }
    const data = await response.text();
    const paper = this.#filterPaperData(data, id);

    return paper;
  }
}

class Renderer {
  #getPaperBlockHTML(/** @type {PaperData} */ result) {
    return `
</div><div class="paper-block">
    <div class="paper-card accordion">
        <div>
            <h3 class="paper-title">${result.data.title}</h3>
            <a class="paper-link" href="${result.data.id}">${result.data.id}</a>
        </div>
    </div>
    <div class="paper-abstract panel">
        <p>${result.data.summary}</p>
        <button onclick="localDataManager.removePaper('${result.id}')">DELETE</button>
        <hr>
    </div>
</div>
`;
  }

  #getLinkHTML(/** @type {String} */ link) {
    return `
<div>
<a href="${link}" class="link">${
      link.length > 50 ? link.slice(0, 49) + "..." : link
    }</a>
<button onclick="localDataManager.removeLink('${link}')">X</button>
</div>
`;
  }

  static paperCardClick() {
    this.classList.toggle("active");

    var panel = this.nextElementSibling;
    if (panel.style.display === "block") {
      panel.style.display = "none";
    } else {
      panel.style.display = "block";
    }
  }

  #renderPapers(papers) {
    // Render papers
    if (papers.length == 0) {
      paperContainer.innerHTML = "<h2>Let's get going</h2>";
      return;
    }

    let html = papers.map((val) => this.#getPaperBlockHTML(val));
    html = html.join("\n");
    paperContainer.innerHTML = html;

    // Adding accordion ev lis...
    var acc = document.getElementsByClassName("accordion");
    for (let i = 0; i < acc.length; i++) {
      acc[i].addEventListener("click", Renderer.paperCardClick);
    }
  }

  #renderLinks(links) {
    if (links.length == 0) {
      linkContainer.innerHTML = "<h4>Nothing's here...</h4>";
      return;
    }

    let html = links.map((val) => this.#getLinkHTML(val));
    html = html.join("\n");
    linkContainer.innerHTML = html;
  }

  render({ papers, links }) {
    this.#renderPapers(papers);
    this.#renderLinks(links);
  }
}

const parser = new XMLParser();

const PAPER_LOCALSTORAGE_KEY = "data";
const LINK_LOCALSTORAGE_KEY = "data_links";

class PaperData {
  link = undefined;
  data = undefined;
  id = undefined;

  constructor(link, data, id) {
    this.link = link;
    this.data = data;
    this.id = id;
  }
}

function parse(/** @type {String} */ url) {
  const url_split = url.split("/");

  let final_id = "";
  final_id = url_split[url_split.length - 1];

  if (final_id.includes("pdf")) final_id.replace(".pdf", "");

  if (!final_id || final_id.split(".").length != 2) return;

  return final_id;
}

function paperCardClick() {
  this.classList.toggle("active");
  var panel = this.nextElementSibling;
  if (panel.style.display === "block") {
    panel.style.display = "none";
  } else {
    panel.style.display = "block";
  }
}

const renderer = new Renderer();
const remoteStore = new RemoteStore();
const localDataManager = new LocalDataManager((e, data) => {
  renderer.render(localDataManager.getAllData());
  remoteStore.updateData(data);
});

remoteStore
  .getData()
  .then((data) => {
    try {
      localDataManager.importData(JSON.stringify(data));
    } catch (error) {}
  })
  .catch(() => {});

renderer.render(localDataManager.getAllData());

new_link_button.addEventListener("click", async (e) => {
  e.preventDefault();

  /** @type {String} */ const link = link_input_box.value;
  if (!link) {
    alert("Specify a link!");
    return;
  }

  try {
    new URL(link);
    if (link.includes("arxiv")) await localDataManager.addPaper(parse(link));
    else throw new Error("not a arxiv link");
  } catch (error) {
    try {
      new URL(link);
      localDataManager.addLink(link);
    } catch (error) {
      try {
        await localDataManager.addPaper(parse(link));
      } catch (error) {
        console.error(error);
        alert("Not a valid/supported URL");
      }
    }
  }

  link_input_box.value = "";
});

function changeRemoteId() {
  const id = prompt("Enter new id");
  if (!id) return;

  remoteStore.setRemoteId(id);
  remoteStore.getData().then((data) => {
    localDataManager.importData(JSON.stringify(data));
  });
}

function getRemoteId() {
  alert(`Use the key copied to clipboard`);
  copyToClipboard(remoteStore.remoteKey);
}

function copyToClipboard(data) {
  const textArea = document.createElement("textarea");
  textArea.value = data;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}
