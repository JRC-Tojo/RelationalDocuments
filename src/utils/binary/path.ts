import * as path from 'path';

function replaceSep(pathstr: string) {
  return pathstr.replace(/[\\/]+/, path.sep).replace(/[\\/]+$/, '');
}

export class Path {
  private _path: string;
  constructor(value?: string | Path) {
    if (value === undefined) {
      this._path = '';
    } else if (typeof value === 'string') {
      this._path = path.normalize(replaceSep(value));
    } else {
      this._path = value._path;
    }
  }

  child(...paths: string[]) {
    if (this._path !== '') {
      return new Path(path.join(this._path, ...paths));
    }
    return new Path(path.join(...paths));
  }

  parent(times = 1) {
    if (this._path) {
      return new Path(path.join(this._path, ...new Array(times).fill('..')));
    }
    return new Path(path.join(...Array(times).fill('..')));
  }

  absolute() {
    return new Path(path.resolve(this._path));
  }

  /** このpathを起点にしたtargetの相対パスを返す */
  relativeto(target: Path) {
    return new Path(path.relative(this._path, target._path));
  }

  /** パスを文字列化する */
  get path() {
    return this._path;
  }

  /** "で囲まれたパス文字列を返す */
  get quotedPath() {
    return `"${this._path.replace('\\', '\\\\').replace('"', '\\"')}"`;
  }

  /** ディレクトリ階層を除いたファイル名を返す ".../../file.txt" -> "file.txt" */
  basename() {
    return path.basename(this._path);
  }

  /** ディレクトリ階層を除いたファイル名(拡張子なし)を返す ".../../file.txt" -> "file" */
  stemname() {
    return path.basename(this._path, this.extname());
  }

  /** 拡張子を返す ".../../file.txt" -> ".txt" */
  extname() {
    return path.extname(this._path);
  }
}
