import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Preview } from '../components/Preview';
import { useOutput } from '../store/output';

/** 結果画面（主にスマホ用。PC ではホームの右側にも同じ表示がある） */
export default function Result() {
  const set = useOutput((s) => s.set);
  const unseen = useOutput((s) => s.unseen);
  const original = useOutput((s) => s.original);
  useEffect(() => {
    if (unseen) set({ unseen: false });
  }, [unseen, set]);

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <Preview fill />
      {!original && (
        <p className="mt-3 text-center text-sm text-muted">
          <Link to="/" className="font-semibold text-accent underline">
            作成
          </Link>
          {' '}タブで JSON と画像を入れてください
        </p>
      )}
    </div>
  );
}
