const new_link_button = document.getElementById("new_link");
const link_input_box = document.getElementById("input_box");
const paperContainer = document.getElementById("paper-container");

const parser = new XMLParser();

const LOCALSTORAGE_KEY = "data";

class Result {
  link = undefined;
  data = undefined;
  id = undefined;

  constructor(link, data, id) {
    this.link = link;
    this.data = data;
    this.id = id;
  }
}

/** @type {[Result]} */ let global_data =
  JSON.parse(localStorage.getItem(LOCALSTORAGE_KEY)) || [];

function filterData(data, /** @type {String} */ link, id) {
  if (!data || !data.feed || !data.feed.id) return null;

  return new Result(link, data.feed.entry, id);
}

async function getLinkResult(/** @type {String} */ url) {
  const url_split = url.split("/");

  let final_id = "";
  final_id = url_split[url_split.length - 1];

  if (final_id.includes("pdf")) final_id.replace(".pdf", "");

  if (!final_id || final_id.split(".").length != 2) {
    alert("Some error occured!");
    return;
  }

  const result = await fetch(
    `https://export.arxiv.org/api/query?id_list=${final_id}`
  )
    .then((data) => data.text())
    .then((data) => filterData(parser.parse(data), url, final_id))
    .catch((err) => {
      console.error(err);
      alert("Some error occured!");
      return;
    });

  if (!result || !global_data.map((a) => a.id).includes(result.id))
    global_data.push(result), render();
}

new_link_button.addEventListener("click", (e) => {
  e.preventDefault();

  /** @type {String} */ const link = link_input_box.value;
  if (!link) {
    alert("Specify a link!");
    return;
  }

  try {
    new URL(link);
    getLinkResult(link);
  } catch (error) {
    if(link.split(".").length == 2 && link.split('/').length == 1)
      return getLinkResult(link);
    alert("Not a valid/supported URL");
  }

  link_input_box.value = "";
});

function getBlockHTML(/** @type {Result} */ result) {
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
        <button onclick="removePaper('${result.id}')">DELETE</button>
        <hr>
    </div>
</div>
`;
}

function render() {
  if (global_data.length == 0) {
    paperContainer.innerHTML = "<h2>Let's get going</h2>";
    return;
  }

  localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(global_data));

  let html = global_data.map((val) => getBlockHTML(val));

  html = html.join("\n");

  paperContainer.innerHTML = html;

  var acc = document.getElementsByClassName("accordion");
  var i;

  for (i = 0; i < acc.length; i++) {
    acc[i].addEventListener("click", paperCardClick);
  }
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

function removePaper(paper_id) {
  global_data = global_data.filter((val) => val.id != paper_id);
  render();
}

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

function export_data() {
  if (global_data.length) download("export.json", JSON.stringify(global_data));
  else {
    alert("No data available to export!");
    return;
  }
}

function clear_data() {
  localStorage.removeItem(LOCALSTORAGE_KEY);
  global_data = [];
  render();
}

function import_data() {
  const data = prompt("Paste the exported data");
  try {
    let new_data = JSON.parse(data);
    new_data = new_data.filter(
      (val) => !global_data.map((val) => val.id).includes(val.id)
    );

    if (new_data) {
      for (let i of new_data) global_data.push(i);
      render();
    }
  } catch (error) {
    console.error(error);
    alert("Error occured while importing!");
  }
}

render();
