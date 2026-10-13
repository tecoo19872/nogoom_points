import React, { useState, useEffect, useRef } from 'react';
import { db, doc, onSnapshot, setDoc, serverTimestamp } from './firebase';

interface Student {
  n: string;
  s: number[];
}

interface ImpactItem {
  s: number;
  j: number;
  n: string;
  d: string;
}

interface ParentItem {
  n: string;
  d: string;
  t: string;
}

interface PlatformData {
  students: Student[];
  impact: ImpactItem[];
  parents: ParentItem[];
}

const SI = ["📖", "🔤", "🕌", "💻", "🌍", "➕", "🔬"];
const SUBJ = ["اللغة العربية", "اللغة الإنجليزية", "الإسلاميات", "المهارات الرقمية", "الاجتماعيات", "الرياضيات", "العلوم"];
const SHORT = ["عربي", "إنجليزي", "إسلاميات", "رقمية", "اجتماعيات", "رياضيات", "علوم"];
const STR = [
  "اعرف – أريد أن أعرف – تعلمت",
  "قبعات التفكير الست",
  "فكّر – زاوج – شارك",
  "خريطة المفاهيم",
  "السبب والنتيجة",
  "المقارنة والتصنيف",
  "لماذا؟ خمس مرات",
  "ماذا لو؟",
  "حل المشكلات بخطوات",
  "ادّعاء – دليل – تبرير",
  "صحيح أم رأي؟",
  "استبدل – ادمج – عدّل",
  "تذكرة الخروج"
];
const TABS = ["الرئيسية", "توثيق الأثر", "لوحة الشرف", "ولية الأمر المتعاونة"];

export default function App() {
  const [tab, setTab] = useState(0);
  const [role, setRole] = useState<'t' | 'p' | null>(() => {
    try {
      return (sessionStorage.getItem('r') as 't' | 'p' | null) || null;
    } catch {
      return null;
    }
  });

  const [data, setData] = useState<PlatformData>(() => {
    try {
      const saved = localStorage.getItem('nojoum-altafkeer-v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          students: parsed.students || [],
          impact: parsed.impact || [],
          parents: parsed.parents || []
        };
      }
    } catch {
      // fallback
    }
    return { students: [], impact: [], parents: [] };
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const [showLogin, setShowLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [dirty, setDirty] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);

  // Form states
  const [impactStrategy, setImpactStrategy] = useState(0);
  const [impactSubject, setImpactSubject] = useState(0);
  const [impactNote, setImpactNote] = useState('');

  const [studentName, setStudentName] = useState('');

  const [parentName, setParentName] = useState('');
  const [studentOfParent, setStudentOfParent] = useState('');
  const [parentContribution, setParentContribution] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 3200);
  };

  const isTeacher = role === 't';

  // Save changes locally and to Firestore
  const saveState = async (updated: PlatformData) => {
    setData(updated);
    try {
      localStorage.setItem('nojoum-altafkeer-v1', JSON.stringify(updated));
      setDirty(false);
    } catch {
      setDirty(true);
      showToast('تعذّر الحفظ في هذا المتصفح');
    }

    try {
      const sharedDocRef = doc(db, 'platformData', 'shared');
      await setDoc(sharedDocRef, {
        students: updated.students,
        impact: updated.impact,
        parents: updated.parents,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Firestore save failed:', err);
      setDirty(true);
      showToast('حُفظت البيانات محليًا، وتعذّر الرفع للسحابة. تأكدي من قواعد Firestore أو تفعيل الخدمة.');
    }
  };

  // Setup Firestore live sync
  useEffect(() => {
    try {
      const sharedDocRef = doc(db, 'platformData', 'shared');
      const unsubscribe = onSnapshot(
        sharedDocRef,
        (snap) => {
          setCloudReady(true);
          if (snap.exists()) {
            const cloudData = snap.data();
            const hasCloudStudents = Array.isArray(cloudData.students) && cloudData.students.length > 0;
            const hasCloudImpact = Array.isArray(cloudData.impact) && cloudData.impact.length > 0;
            const hasCloudParents = Array.isArray(cloudData.parents) && cloudData.parents.length > 0;
            const cloudHasContent = hasCloudStudents || hasCloudImpact || hasCloudParents;

            const localSaved = localStorage.getItem('nojoum-altafkeer-v1');
            const localObj = localSaved ? JSON.parse(localSaved) : null;
            const localHasContent = !!(
              (localObj?.students?.length) ||
              (localObj?.impact?.length) ||
              (localObj?.parents?.length)
            );

            // If cloud is empty but local has data, push local data to cloud so nothing is lost
            if (!cloudHasContent && localHasContent) {
              const fresh = {
                students: localObj.students || [],
                impact: localObj.impact || [],
                parents: localObj.parents || []
              };
              saveState(fresh);
              showToast('تم الحفاظ على بيانات هذا الجهاز ومزامنتها سحابيًا');
              return;
            }

            const merged: PlatformData = {
              students: Array.isArray(cloudData.students) ? cloudData.students : [],
              impact: Array.isArray(cloudData.impact) ? cloudData.impact : [],
              parents: Array.isArray(cloudData.parents) ? cloudData.parents : []
            };

            setData(merged);
            try {
              localStorage.setItem('nojoum-altafkeer-v1', JSON.stringify(merged));
            } catch {
              // Ignore
            }
          } else {
            // First time document initialization if local data exists
            const localSaved = localStorage.getItem('nojoum-altafkeer-v1');
            if (localSaved) {
              try {
                const parsed = JSON.parse(localSaved);
                if (parsed.students?.length || parsed.impact?.length || parsed.parents?.length) {
                  saveState(parsed);
                }
              } catch {
                // Ignore
              }
            }
          }
        },
        (error) => {
          console.error('Firestore listener error:', error);
          setCloudReady(false);
          showToast('تعذّر الاتصال بقاعدة البيانات السحابية (تحققي من صلاحيات Firebase). تعمل البيانات حالياً محلياً.');
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.error('Failed to initialize Firebase snapshot:', e);
      setCloudReady(false);
    }
  }, []);

  const handleLogin = () => {
    const val = password.trim();
    const newRole = val === '1234' ? 't' : val === '0000' ? 'p' : null;
    if (!newRole) {
      showToast('كلمة المرور غير صحيحة');
      return;
    }
    setRole(newRole);
    try {
      sessionStorage.setItem('r', newRole);
    } catch {
      // Ignore
    }
    setShowLogin(false);
    setPassword('');
    showToast(newRole === 't' ? 'مرحبًا بكِ يا معلمة' : 'مرحبًا بكِ يا مديرة');
  };

  const handleLogout = () => {
    setRole(null);
    try {
      sessionStorage.removeItem('r');
    } catch {
      // Ignore
    }
    showToast('تم تسجيل الخروج');
  };

  const addImpact = () => {
    const note = impactNote.trim();
    if (!note) {
      showToast('اكتبي الملاحظة أولًا');
      return;
    }
    const newItem: ImpactItem = {
      s: impactStrategy,
      j: impactSubject,
      n: note,
      d: new Date().toLocaleDateString('ar-SA')
    };
    const updated = {
      ...data,
      impact: [newItem, ...data.impact]
    };
    saveState(updated);
    setImpactNote('');
    showToast('تمت إضافة التوثيق بنجاح');
  };

  const deleteImpact = (index: number) => {
    const updated = {
      ...data,
      impact: data.impact.filter((_, i) => i !== index)
    };
    saveState(updated);
    showToast('تم حذف التوثيق');
  };

  const addStudent = () => {
    const name = studentName.trim();
    if (!name) {
      showToast('اكتبي اسم الطالبة');
      return;
    }
    const newStudent: Student = {
      n: name,
      s: [0, 0, 0, 0, 0, 0, 0]
    };
    const updated = {
      ...data,
      students: [...data.students, newStudent]
    };
    saveState(updated);
    setStudentName('');
    showToast(`تمت إضافة الطالبة ${name}`);
  };

  const deleteStudent = (index: number) => {
    const updated = {
      ...data,
      students: data.students.filter((_, i) => i !== index)
    };
    saveState(updated);
    showToast('تم حذف الطالبة');
  };

  const toggleStar = (studentIndex: number, subjectIndex: number) => {
    if (!isTeacher) return;
    const updatedStudents = data.students.map((st, i) => {
      if (i !== studentIndex) return st;
      const stars = [...st.s];
      stars[subjectIndex] = stars[subjectIndex] ? 0 : 1;
      return { ...st, s: stars };
    });
    saveState({ ...data, students: updatedStudents });
  };

  const addParent = () => {
    const name = parentName.trim();
    if (!name) {
      showToast('اكتبي اسم ولية الأمر');
      return;
    }
    const newParent: ParentItem = {
      n: name,
      d: studentOfParent.trim(),
      t: parentContribution.trim()
    };
    const updated = {
      ...data,
      parents: [...data.parents, newParent]
    };
    saveState(updated);
    setParentName('');
    setStudentOfParent('');
    setParentContribution('');
    showToast('شكرًا لتعاونك ومشاركتك 💜');
  };

  const deleteParent = (index: number) => {
    const updated = {
      ...data,
      parents: data.parents.filter((_, i) => i !== index)
    };
    saveState(updated);
    showToast('تم حذف المشاركة');
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'nojoum-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('تم تصدير البيانات بنجاح');
  };

  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const imported: PlatformData = {
          students: Array.isArray(parsed.students) ? parsed.students : [],
          impact: Array.isArray(parsed.impact) ? parsed.impact : [],
          parents: Array.isArray(parsed.parents) ? parsed.parents : []
        };
        saveState(imported);
        showToast('تم استيراد البيانات بنجاح');
      } catch {
        showToast('ملف غير صالح');
      }
    };
    reader.readAsText(file);
  };

  const totalStars = data.students.reduce((acc, st) => acc + st.s.reduce((a, b) => a + b, 0), 0);

  return (
    <div>
      {/* Toast Notification */}
      {toastMsg && (
        <div id="toast" role="status">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <header>
        <div>
          <h1>منصة نجوم التفكير</h1>
          <p>لطالبات الابتدائية السابعة والثلاثون</p>
        </div>
        <div className="who">
          <span className="chip">
            {role === 't' ? 'المعلمة' : role === 'p' ? 'المديرة' : 'ولية أمر'}
          </span>
          <button
            className="btn alt"
            onClick={() => {
              if (role) {
                handleLogout();
              } else {
                setPassword('');
                setShowLogin(true);
              }
            }}
          >
            {role ? 'تسجيل الخروج' : 'دخول المعلمة أو المديرة'}
          </button>
        </div>
      </header>

      {/* Main Tabs Navigation */}
      <nav className="main-nav">
        <div role="tablist">
          {TABS.map((t, idx) => (
            <button
              key={idx}
              role="tab"
              aria-selected={tab === idx}
              onClick={() => {
                setTab(idx);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {/* Tab 0: Home */}
        {tab === 0 && (
          <section className="home on">
            <div className="hero">
              <div className="hero-stars">✦ ✧ ★ ✧ ✦</div>
              <div>
                <span className="hero-badge">🌟 منصة تعليمية تفاعلية</span>
                <h2>أهلًا بكِ في منصة نجوم التفكير</h2>
                <p>نفكر بذكاء، نتعلم بإبداع، ونبدع معًا ✨</p>
                <div className="hero-actions">
                  <button className="btn gold" onClick={() => setTab(1)}>
                    ابدئي بتوثيق الأثر 🚀
                  </button>
                  <button className="btn alt" onClick={() => setTab(2)}>
                    شاهدي لوحة الشرف ⭐
                  </button>
                </div>
              </div>
              <div className="hero-orbit">
                <span>💡</span>
                <b>⭐</b>
                <span>🧩</span>
                <span>🔍</span>
              </div>
            </div>

            <div className="quick-grid">
              <button onClick={() => setTab(1)}>
                <b>📸</b>
                <strong>توثيق الأثر</strong>
                <small>شاهدي أثر التعلم والتطبيق</small>
              </button>
              <button onClick={() => setTab(2)}>
                <b>🏅</b>
                <strong>نجومي وإنجازاتي</strong>
                <small>اجمعي النجوم واكتسبي الشارات</small>
              </button>
            </div>

            <div className="welcome-note">
              <b>💜 رسالتنا</b>
              <span>كل فكرة تبدأ بسؤال، وكل سؤال يقود إلى اكتشاف جديد.</span>
            </div>
          </section>
        )}

        {/* Tab 1: Impact Documentation */}
        {tab === 1 && (
          <section className="on">
            <h2>توثيق الأثر</h2>

            {isTeacher && (
              <div className="row">
                <select
                  value={impactStrategy}
                  onChange={(e) => setImpactStrategy(+e.target.value)}
                  aria-label="الاستراتيجية"
                >
                  {STR.map((st, i) => (
                    <option key={i} value={i}>
                      {st}
                    </option>
                  ))}
                </select>

                <select
                  value={impactSubject}
                  onChange={(e) => setImpactSubject(+e.target.value)}
                  aria-label="المادة"
                >
                  {SUBJ.map((sb, i) => (
                    <option key={i} value={i}>
                      {sb}
                    </option>
                  ))}
                </select>

                <textarea
                  value={impactNote}
                  onChange={(e) => setImpactNote(e.target.value)}
                  placeholder="ماذا لاحظتِ على الطالبات؟ (اكتبي ملاحظة قصيرة)"
                />

                <button className="btn" onClick={addImpact}>
                  إضافة التوثيق
                </button>
              </div>
            )}

            {data.impact.length > 0 ? (
              <div>
                {data.impact.map((x, i) => (
                  <div key={i} className="imp">
                    <b>{STR[x.s]}</b> <span className="tag">{SUBJ[x.j]}</span>{' '}
                    <small>{x.d}</small>
                    <div style={{ marginTop: 4 }}>{x.n}</div>
                    {isTeacher && (
                      <button
                        className="btn alt"
                        style={{ marginTop: 8, padding: '4px 10px', fontSize: 13 }}
                        onClick={() => deleteImpact(i)}
                      >
                        حذف
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                لا توجد توثيقات بعد.{isTeacher ? ' أضيفي أول تطبيق للاستراتيجية.' : ''}
              </div>
            )}
          </section>
        )}

        {/* Tab 2: Honor Board */}
        {tab === 2 && (
          <section className="on">
            <h2>لوحة الشرف</h2>

            {/* Statistics */}
            <div className="stats">
              <div>
                <b>{data.students.length}</b>الطالبات
              </div>
              <div>
                <b>{totalStars}</b>مجموع النجوم
              </div>
              <div>
                <b>{data.impact.length}</b>توثيقات
              </div>
              {SUBJ.map((_, j) => (
                <div key={j}>
                  <b>{data.students.filter((st) => st.s[j]).length}</b>
                  {SHORT[j]}
                </div>
              ))}
            </div>

            {/* Add student (Teacher only) */}
            {isTeacher && (
              <div className="row">
                <input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="اسم الطالبة"
                  aria-label="اسم الطالبة"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addStudent();
                  }}
                />
                <button className="btn" onClick={addStudent}>
                  إضافة طالبة
                </button>
              </div>
            )}

            {/* Subjects Overview Grid */}
            <div className="grid-cards" style={{ marginBottom: 16 }}>
              {SUBJ.map((subName, j) => {
                const withStars = data.students.filter((s) => s.s[j]);
                return (
                  <div className="card" key={j}>
                    <div className="ico">{SI[j]}</div>
                    <h3>{subName}</h3>
                    <div>
                      {withStars.length > 0 ? (
                        withStars.map((s, idx) => (
                          <span
                            key={idx}
                            className="tag"
                            style={{ margin: 2 }}
                          >
                            ★ {s.n}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--mut)' }}>لا توجد نجوم بعد</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Students List with Star Toggles */}
            {data.students.length > 0 ? (
              <div>
                {data.students.map((s, i) => {
                  const studentStars = s.s.reduce((a, b) => a + b, 0);
                  return (
                    <div className="stu" key={i}>
                      <div className="top">
                        <b>{s.n}</b>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="tot">★ {studentStars}</span>
                          {isTeacher && (
                            <button
                              className="btn alt"
                              style={{ padding: '2px 8px', fontSize: 16 }}
                              onClick={() => deleteStudent(i)}
                              aria-label="حذف"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      </div>
                      <div className="stars">
                        {SHORT.map((shortName, j) => (
                          <button
                            key={j}
                            className="st"
                            disabled={!isTeacher}
                            aria-pressed={!!s.s[j]}
                            aria-label={SUBJ[j]}
                            onClick={() => toggleStar(i, j)}
                            title={isTeacher ? `تبديل نجمة ${SUBJ[j]}` : SUBJ[j]}
                          >
                            <i>{SI[j]}</i>
                            <span>★</span>
                            {shortName}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty">
                لوحة الشرف فارغة.{isTeacher ? ' أضيفي أسماء الطالبات ثم امنحيهن نجمة لكل مادة.' : ''}
              </div>
            )}
          </section>
        )}

        {/* Tab 3: Cooperative Parent */}
        {tab === 3 && (
          <section className="on">
            <h2>ولية الأمر المتعاونة</h2>
            <p style={{ color: 'var(--mut)', marginTop: -8 }}>
              شكرًا لكل ولية أمر تدعم بناتنا في التعلم.
            </p>

            <div className="row">
              <input
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="اسم ولية الأمر"
              />
              <input
                value={studentOfParent}
                onChange={(e) => setStudentOfParent(e.target.value)}
                placeholder="اسم الطالبة"
              />
              <textarea
                value={parentContribution}
                onChange={(e) => setParentContribution(e.target.value)}
                placeholder="كيف ساهمت في دعم التعلم؟"
              />
              <button className="btn" onClick={addParent}>
                إضافة
              </button>
            </div>

            {data.parents.length > 0 ? (
              <div className="grid-cards">
                {data.parents.map((p, i) => (
                  <div className="card" key={i}>
                    <div className="ico">🤝</div>
                    <h3>{p.n}</h3>
                    {p.d && <span className="tag">ولية أمر الطالبة {p.d}</span>}
                    {p.t && <p>{p.t}</p>}
                    {isTeacher && (
                      <button
                        className="btn alt"
                        style={{ marginTop: 8, padding: '4px 10px', fontSize: 13 }}
                        onClick={() => deleteParent(i)}
                      >
                        حذف
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">
                لا توجد أسماء بعد. كوني أول ولية أمر متعاونة 💜
              </div>
            )}
          </section>
        )}

        {/* Teacher Import / Export Controls */}
        {isTeacher && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button className="btn alt" style={{ marginInline: 4 }} onClick={exportData}>
              تصدير البيانات
            </button>
            <button
              className="btn alt"
              style={{ marginInline: 4 }}
              onClick={() => fileInputRef.current?.click()}
            >
              استيراد بيانات
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  importData(e.target.files[0]);
                }
              }}
            />
          </div>
        )}
      </main>

      {/* Unsaved bar indicator */}
      {dirty && (
        <div id="bar">
          <span>توجد تغييرات غير محفوظة في السحابة</span>
          <button className="btn gold" onClick={() => saveState(data)}>
            حفظ الآن
          </button>
        </div>
      )}

      {/* Login Dialog */}
      {showLogin && (
        <div id="login-modal">
          <div className="card">
            <h3>تسجيل الدخول</h3>
            <input
              type="password"
              inputMode="numeric"
              placeholder="كلمة المرور"
              aria-label="كلمة المرور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin();
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={handleLogin}>
                دخول
              </button>
              <button
                className="btn alt"
                onClick={() => {
                  setShowLogin(false);
                  setPassword('');
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
